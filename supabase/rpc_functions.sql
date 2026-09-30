-- =========================================================
-- MiCuadre.app - Atomic Stored Procedures (PL/pgSQL)
-- Handles SAR Fiscal Locks, CPP Calculations, Kardex Entries & Cash Closes
-- =========================================================

-- 1. ATOMIC PURCHASE INVOICE & CPP CALCULATOR
CREATE OR REPLACE FUNCTION process_purchase_invoice(
    p_tenant_id UUID,
    p_supplier_id UUID,
    p_invoice_number VARCHAR,
    p_cai VARCHAR,
    p_issue_date DATE,
    p_due_date DATE,
    p_payment_terms VARCHAR,
    p_subtotal NUMERIC,
    p_tax_amount NUMERIC,
    p_total NUMERIC,
    p_items JSONB -- Array of { product_id, quantity, unit_cost, new_sale_price }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_id UUID;
    v_item JSONB;
    v_prod_id UUID;
    v_qty INT;
    v_cost NUMERIC(12, 2);
    v_new_sale_price NUMERIC(12, 2);
    v_old_stock INT;
    v_old_cost NUMERIC(12, 2);
    v_new_cost NUMERIC(12, 2);
    v_new_stock INT;
BEGIN
    -- 1. Insert Purchase Invoice
    INSERT INTO purchase_invoices (
        tenant_id, supplier_id, invoice_number, cai, issue_date, due_date,
        payment_terms, subtotal, tax_amount, total
    ) VALUES (
        p_tenant_id, p_supplier_id, p_invoice_number, p_cai, p_issue_date, p_due_date,
        p_payment_terms, p_subtotal, p_tax_amount, p_total
    ) RETURNING id INTO v_invoice_id;

    -- 2. Process Items & Update CPP
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        v_cost := (v_item->>'unit_cost')::numeric;
        v_new_sale_price := (v_item->>'new_sale_price')::numeric;

        -- Lock product row to read stock & current cost
        SELECT current_stock, cost_price INTO v_old_stock, v_old_cost
        FROM products
        WHERE id = v_prod_id AND tenant_id = p_tenant_id
        FOR UPDATE;

        -- Calculate Weighted Average Cost (CPP)
        IF (v_old_stock + v_qty) > 0 THEN
            v_new_cost := ROUND(((v_old_stock * v_old_cost) + (v_qty * v_cost)) / (v_old_stock + v_qty), 2);
        ELSE
            v_new_cost := v_cost;
        END IF;

        v_new_stock := v_old_stock + v_qty;

        -- Update product
        UPDATE products
        SET current_stock = v_new_stock,
            cost_price = v_new_cost,
            sale_price = COALESCE(v_new_sale_price, sale_price)
        WHERE id = v_prod_id;

        -- Insert Kardex entry
        INSERT INTO inventory_kardex (
            tenant_id, product_id, movement_type, reference_id,
            quantity_changed, cost_price, stock_after, notes
        ) VALUES (
            p_tenant_id, v_prod_id, 'PURCHASE_IN', v_invoice_id,
            v_qty, v_cost, v_new_stock, 'Compra de Mercancía #' || p_invoice_number
        );
    END LOOP;

    -- 3. If CREDIT, add Financial Event
    IF p_payment_terms = 'CREDIT' THEN
        INSERT INTO financial_events (
            tenant_id, event_type, title, description, due_date, amount, reference_id
        ) VALUES (
            p_tenant_id, 'SUPPLIER_PAYMENT',
            'Pago Proveedor #' || p_invoice_number,
            'Factura de compra a crédito a vencer',
            p_due_date, p_total, v_invoice_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id);
END;
$$;


-- 2. ATOMIC POS SALE PROCESSOR (WITH SAR LOCK & IDEMPOTENCY)
CREATE OR REPLACE FUNCTION process_pos_sale(
    p_tenant_id UUID,
    p_cash_shift_id UUID,
    p_customer_name VARCHAR,
    p_customer_rtn VARCHAR,
    p_idempotency_key UUID,
    p_is_fiscal BOOLEAN,
    p_subtotal NUMERIC,
    p_discount_amount NUMERIC,
    p_exempt_amount NUMERIC,
    p_exonerated_amount NUMERIC,
    p_taxable_15 NUMERIC,
    p_tax_15 NUMERIC,
    p_taxable_18 NUMERIC,
    p_tax_18 NUMERIC,
    p_total NUMERIC,
    p_payment_method VARCHAR,
    p_items JSONB -- Array of { product_id, service_id, staff_id, quantity, unit_price, discount_amount, tax_classification, tax_amount, subtotal }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_sale_id UUID;
    v_existing_doc_number VARCHAR;
    v_sale_id UUID;
    v_doc_number VARCHAR;
    v_cai VARCHAR := NULL;
    v_range_record RECORD;
    v_item JSONB;
    v_prod_id UUID;
    v_service_id UUID;
    v_staff_id UUID;
    v_qty INT;
    v_unit_price NUMERIC(12, 2);
    v_item_subtotal NUMERIC(12, 2);
    v_curr_stock INT;
    v_cost_price NUMERIC(12, 2);
    v_allow_negative BOOLEAN;
    v_comm_type VARCHAR;
    v_comm_val NUMERIC(12, 2);
    v_comm_calc NUMERIC(12, 2);
BEGIN
    -- 1. Check Idempotency Key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, document_number INTO v_existing_sale_id, v_existing_doc_number
        FROM sales WHERE idempotency_key = p_idempotency_key;

        IF v_existing_sale_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'sale_id', v_existing_sale_id,
                'document_number', v_existing_doc_number,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- 2. Determine Document Number
    IF p_is_fiscal THEN
        -- Atomic lock on active SAR range
        SELECT * INTO v_range_record
        FROM fiscal_ranges
        WHERE tenant_id = p_tenant_id AND is_active = TRUE AND document_type = '01'
          AND deadline >= CURRENT_DATE AND current_number < range_end
        FOR UPDATE;

        IF v_range_record.id IS NULL THEN
            RAISE EXCEPTION 'No se encontró un Rango Fiscal SAR activo o válido para la emisión.';
        END IF;

        -- Format: PPP-PPP-TT-CCCCCCCC (16 chars)
        v_doc_number := v_range_record.prefix || LPAD((v_range_record.current_number + 1)::text, 8, '0');
        v_cai := v_range_record.cai;

        -- Update consecutive number
        UPDATE fiscal_ranges
        SET current_number = current_number + 1,
            is_active = CASE WHEN (current_number + 1) >= range_end THEN FALSE ELSE TRUE END
        WHERE id = v_range_record.id;
    ELSE
        -- Non-fiscal internal ticket number
        v_doc_number := 'TICK-' || LPAD((FLOOR(RANDOM() * 900000) + 100000)::text, 6, '0');
    END IF;

    -- 3. Insert Sale
    INSERT INTO sales (
        tenant_id, cash_shift_id, document_number, is_fiscal, cai, customer_rtn,
        customer_name, idempotency_key, subtotal, discount_amount, exempt_amount,
        exonerated_amount, taxable_15, tax_15, taxable_18, tax_18, total, payment_method
    ) VALUES (
        p_tenant_id, p_cash_shift_id, v_doc_number, p_is_fiscal, v_cai, p_customer_rtn,
        COALESCE(p_customer_name, 'Consumidor Final'), p_idempotency_key, p_subtotal,
        p_discount_amount, p_exempt_amount, p_exonerated_amount, p_taxable_15, p_tax_15,
        p_taxable_18, p_tax_18, p_total, p_payment_method
    ) RETURNING id INTO v_sale_id;

    -- Read tenant negative stock policy
    SELECT allow_negative_stock INTO v_allow_negative FROM tenants WHERE id = p_tenant_id;

    -- 4. Process Sale Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_prod_id := NULLIF(v_item->>'product_id', '')::uuid;
        v_service_id := NULLIF(v_item->>'service_id', '')::uuid;
        v_staff_id := NULLIF(v_item->>'staff_id', '')::uuid;
        v_qty := (v_item->>'quantity')::int;
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_subtotal := (v_item->>'subtotal')::numeric;

        INSERT INTO sale_items (
            tenant_id, sale_id, product_id, service_id, staff_id, quantity,
            unit_price, discount_amount, tax_classification, tax_amount, subtotal
        ) VALUES (
            p_tenant_id, v_sale_id, v_prod_id, v_service_id, v_staff_id, v_qty,
            v_unit_price, COALESCE((v_item->>'discount_amount')::numeric, 0.00),
            (v_item->>'tax_classification'), (v_item->>'tax_amount')::numeric, v_item_subtotal
        );

        -- If product item, adjust stock & Kardex
        IF v_prod_id IS NOT NULL THEN
            SELECT current_stock, cost_price INTO v_curr_stock, v_cost_price
            FROM products WHERE id = v_prod_id AND tenant_id = p_tenant_id
            FOR UPDATE;

            IF NOT v_allow_negative AND (v_curr_stock - v_qty) < 0 THEN
                RAISE EXCEPTION 'Inventario insuficiente para el producto seleccionado.';
            END IF;

            UPDATE products SET current_stock = current_stock - v_qty WHERE id = v_prod_id;

            INSERT INTO inventory_kardex (
                tenant_id, product_id, movement_type, reference_id,
                quantity_changed, cost_price, stock_after, notes
            ) VALUES (
                p_tenant_id, v_prod_id, 'SALE_OUT', v_sale_id,
                -v_qty, v_cost_price, (v_curr_stock - v_qty), 'Venta en POS Doc #' || v_doc_number
            );
        END IF;

        -- If service item with staff, calculate commission
        IF v_service_id IS NOT NULL AND v_staff_id IS NOT NULL THEN
            SELECT commission_type, commission_value INTO v_comm_type, v_comm_val
            FROM services WHERE id = v_service_id;

            IF v_comm_type = 'PERCENTAGE' THEN
                v_comm_calc := ROUND((v_item_subtotal * v_comm_val) / 100.0, 2);
            ELSE
                v_comm_calc := v_comm_val * v_qty;
            END IF;

            INSERT INTO staff_commissions (
                tenant_id, staff_id, sale_id, service_id, sale_amount, commission_amount
            ) VALUES (
                p_tenant_id, v_staff_id, v_sale_id, v_service_id, v_item_subtotal, v_comm_calc
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'document_number', v_doc_number,
        'cai', v_cai,
        'total', p_total
    );
END;
$$;


-- 3. BLIND CASH SHIFT CLOSE PROCESSOR
CREATE OR REPLACE FUNCTION close_cash_shift(
    p_shift_id UUID,
    p_declared_cash NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_total_cash_sales NUMERIC(12, 2);
    v_closing_system NUMERIC(12, 2);
    v_difference NUMERIC(12, 2);
BEGIN
    SELECT * INTO v_shift FROM cash_shifts WHERE id = p_shift_id FOR UPDATE;

    IF v_shift.id IS NULL OR v_shift.status = 'CLOSED' THEN
        RAISE EXCEPTION 'El turno de caja especificado no existe o ya está cerrado.';
    END IF;

    -- Sum cash sales during open shift
    SELECT COALESCE(SUM(total), 0.00) INTO v_total_cash_sales
    FROM sales
    WHERE cash_shift_id = p_shift_id AND payment_method IN ('CASH', 'MIXED');

    v_closing_system := v_shift.opening_amount + v_total_cash_sales;
    v_difference := p_declared_cash - v_closing_system;

    UPDATE cash_shifts
    SET closing_declared = p_declared_cash,
        closing_system = v_closing_system,
        difference = v_difference,
        status = 'CLOSED',
        closed_at = NOW()
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'opening_amount', v_shift.opening_amount,
        'total_cash_sales', v_total_cash_sales,
        'closing_system', v_closing_system,
        'closing_declared', p_declared_cash,
        'difference', v_difference
    );
END;
$$;
