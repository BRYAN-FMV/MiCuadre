import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export const OnboardingTour: React.FC = () => {
  useEffect(() => {
    const handleStartTour = () => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        steps: [
          {
            element: '#nav-pos',
            popover: {
              title: 'Punto de Venta (POS)',
              description: 'Aquí realizas ventas ultrarrápidas con escáner de barras, atajos de teclado (F2, F4, F8, F12) y escalas automáticas de precio de mayoreo.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '#pos-search-input',
            popover: {
              title: 'Lector de Código de Barras (F2)',
              description: 'Presiona F2 o haz clic para escanear productos. El sistema detecta el ítem de inmediato y ajusta el precio si alcanza la cantidad de mayoreo.',
              side: 'bottom'
            }
          },
          {
            element: '#nav-inventory',
            popover: {
              title: 'Inventario & Kardex CPP',
              description: 'Administra productos, precios menudeo/mayoreo y consulta el Kardex permanente con el Costo Promedio Ponderado (CPP) recalculado tras cada compra.',
              side: 'right'
            }
          },
          {
            element: '#nav-purchases',
            popover: {
              title: 'Compras a Proveedores',
              description: 'Registra facturas de compras a contado o al crédito. Las compras al crédito programan automáticamente los pagos en el Calendario Financiero.',
              side: 'right'
            }
          },
          {
            element: '#nav-services',
            popover: {
              title: 'Servicios, Citas & Comisiones',
              description: 'Diseñado para barberías, salones y talleres. Agenda citas, gestiona cola de atención y liquida comisiones automáticamente al cobrar en el POS.',
              side: 'right'
            }
          },
          {
            element: '#nav-calendar',
            popover: {
              title: 'Asistente & Calendario Financiero',
              description: 'Monitorea la liquidez proyectada día a día, recibe alertas preventivas de cuentas a vencer y avisos de vencimientos tributarios de la SAR.',
              side: 'right'
            }
          },
          {
            element: '#nav-settings',
            popover: {
              title: 'Configuración & Modo SAR',
              description: 'Activa o desactiva en 1-clic el Módulo de Facturación Fiscal SAR (Honduras), el stock negativo y gestiona los PINs de tu equipo.',
              side: 'right'
            }
          }
        ]
      });

      driverObj.drive();
    };

    window.addEventListener('start-onboarding-tour', handleStartTour);
    return () => window.removeEventListener('start-onboarding-tour', handleStartTour);
  }, []);

  return null;
};
