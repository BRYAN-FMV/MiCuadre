export interface LegalSection {
  title: string;
  content: string[];
}

export interface LegalDocument {
  id: 'terms' | 'privacy' | 'beta' | 'cookies';
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export const TERMS_AND_CONDITIONS: LegalDocument = {
  id: 'terms',
  title: 'Términos y Condiciones de Uso',
  subtitle: 'Contrato de Servicio para la Plataforma de Punto de Venta y Gestión Comercial (Fase Beta)',
  lastUpdated: 'Octubre 2026',
  sections: [
    {
      title: '1. Aceptación de los Términos',
      content: [
        'El presente contrato regula el acceso y uso de la plataforma web y aplicación de punto de venta y gestión comercial denominada MiCuadre (en adelante, "el Servicio" o "la Plataforma").',
        'Al registrar un comercio, crear un usuario o utilizar las herramientas del sistema, la persona natural o jurídica titular del negocio (en adelante, "el Usuario" o "el Suscriptor") declara haber leído, comprendido y aceptado en su totalidad estos Términos y Condiciones.',
        'Si no está de acuerdo con alguno de los términos aquí estipulados, deberá abstenerse inmediatamente de utilizar la Plataforma.'
      ]
    },
    {
      title: '2. Naturaleza del Programa Beta',
      content: [
        'El Usuario reconoce y acepta expresamente que MiCuadre se ofrece actualmente en calidad de Versión Beta (Piloto).',
        'El software se encuentra en fase de pruebas activas, validación y optimización continua de código y rendimiento.',
        'Pueden presentarse fallas técnicas imprevistas, interrupciones temporales del servicio, retrasos en la sincronización o cambios en las funcionalidades sin previo aviso.',
        'El Servicio se proporciona estrictamente "TAL CUAL" ("AS IS") y "SEGÚN DISPONIBILIDAD", sin garantías explícitas o implícitas sobre continuidad ininterrumpida o ausencia total de errores.',
        'La participación en el programa Beta es voluntaria y tiene como objetivo recabar retroalimentación técnica y operativa para la versión final del producto.'
      ]
    },
    {
      title: '3. Registro de Cuenta y Seguridad de Credenciales',
      content: [
        'El Usuario es responsable de proporcionar información verídica, exacta y actualizada sobre su establecimiento comercial y sus datos de contacto.',
        'El acceso mediante credenciales de administrador, cajero o personal requiere contraseñas y códigos PIN de acceso. El Usuario es el único responsable de salvaguardar la confidencialidad de dichas claves y de todas las actividades realizadas bajo su cuenta.',
        'MiCuadre no se hace responsable por accesos no autorizados resultantes de negligencia, claves compartidas, terminales desatendidos o descuido en los dispositivos del Usuario.'
      ]
    },
    {
      title: '4. Responsabilidad Fiscal, Emisión de Facturas y Normativa SAR (Honduras)',
      content: [
        'Deslinde de Responsabilidad Tributaria: MiCuadre es una solución informática de gestión interna, punto de venta y asistencia en emisión de comprobantes. El Usuario es el único y exclusivo responsable legal ante el Servicio de Administración de Rentas (SAR) y demás autoridades competentes por el cumplimiento cabal de sus obligaciones tributarias.',
        'Parámetros Fiscales y CAI: La exactitud de la información fiscal registrada en el sistema —incluyendo el Registro Tributario Nacional (RTN), Código de Autorización de Emisión (CAI), fecha límite de emisión, rangos autorizados y datos del obligado tributario— recae enteramente en el Usuario.',
        'MiCuadre no valida la autenticidad ni el estado legal de los rangos autorizados por el SAR. El Usuario debe monitorear periódicamente sus vencimientos y límites de facturación.',
        'En ningún caso MiCuadre, sus desarrolladores o socios comerciales responderán por sanciones, multas, clausuras o auditorías impuestas al Usuario derivadas de inconsistencias en la facturación, errores de tipeo en CAI o declaraciones extemporáneas.'
      ]
    },
    {
      title: '5. Arqueos de Caja, Fondos y Operaciones Monetarias',
      content: [
        'La Plataforma facilita el cálculo matemático sugerido de ingresos, egresos, ventas por método de pago y cierres de turno (Reporte Z) a partir de los datos ingresados por los operadores del Usuario.',
        'MiCuadre no es una entidad financiera, no custodia fondos físicos ni dinero en efectivo, y no asume responsabilidad por faltantes, sobrantes, extravíos o desfalcos que ocurran en el establecimiento comercial del Usuario.'
      ]
    },
    {
      title: '6. Tarifas y Gratuidad durante la Fase Beta',
      content: [
        'El acceso a las funcionalidades habilitadas durante la fase Beta podrá otorgarse de forma gratuita o bajo tarifas promocionales especiales según lo determine MiCuadre.',
        'Una vez concluida la fase Beta, MiCuadre informará a los Usuarios con al menos quince (15) días calendario de anticipación las tarifas, modalidades de suscripción o planes comerciales que entrarán en vigencia, otorgando la opción de continuar con el servicio de pago o solicitar la exportación de sus datos.'
      ]
    },
    {
      title: '7. Respaldo de Información y Continuidad Operativa',
      content: [
        'Si bien MiCuadre implementa mecanismos de respaldo periódico y almacenamiento redundante en la nube, durante la fase Beta el Usuario tiene el deber de mantener copias de seguridad físicas, reportes impresos o respaldos contables independientes de sus operaciones críticas.',
        'MiCuadre no será responsable por la pérdida irrecuperable de datos ocasionada por fallas ajenas a su control, caídas de proveedores de infraestructura, cortes de energía en los terminales o desastres fortuitos.'
      ]
    },
    {
      title: '8. Propiedad Intelectual',
      content: [
        'Todos los derechos de propiedad intelectual, marcas, logotipos, código fuente, interfaces de usuario, arquitectura de bases de datos y algoritmos de MiCuadre son propiedad exclusiva de sus desarrolladores.',
        'Se otorga al Usuario una licencia de uso personal, no transferible, revocable y no exclusiva, limitada a la operación interna de su comercio. Queda estrictamente prohibida la ingeniería inversa, descompilación o copia total o parcial de la Plataforma.'
      ]
    },
    {
      title: '9. Limitación de Responsabilidad',
      content: [
        'En la máxima medida permitida por la legislación aplicable, MiCuadre, sus creadores y colaboradores no serán responsables por daños indirectos, incidentales, punitivos, lucro cesante o pérdidas comerciales derivadas del uso o imposibilidad de uso del Servicio, incluso si se hubiera advertido sobre la posibilidad de tales daños.',
        'La responsabilidad económica total de MiCuadre ante cualquier reclamación quedará limitada a la suma efectivamente pagada por el Usuario en los tres (3) meses anteriores al hecho causante, o a la cantidad de Cero Lempiras (L. 0.00) en caso de suscripciones gratuitas de prueba.'
      ]
    },
    {
      title: '10. Modificaciones a los Términos',
      content: [
        'MiCuadre se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios relevantes serán notificados dentro de la aplicación o vía correo electrónico.',
        'El uso continuado del Servicio tras la publicación de los cambios constituye la aceptación íntegra de los nuevos términos.'
      ]
    },
    {
      title: '11. Ley Aplicable y Jurisdicción',
      content: [
        'Estos Términos se rigen e interpretan de conformidad con las leyes de la República de Honduras.',
        'Cualquier disputa derivada de este contrato se someterá a los tribunales competentes de la jurisdicción del domicilio legal del proveedor de MiCuadre.'
      ]
    }
  ]
};

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Política de Privacidad y Tratamiento de Datos',
  subtitle: 'Protección, Confidencialidad y Seguridad de la Información Comercial',
  lastUpdated: 'Octubre 2026',
  sections: [
    {
      title: '1. Identificación y Alcance',
      content: [
        'Esta Política de Privacidad describe la forma en que MiCuadre recopila, almacena, utiliza y protege los datos personales y comerciales generados a través de la Plataforma.',
        'Aplica a todos los usuarios registrados, administradores, personal del comercio y clientes finales cuyos datos sean gestionados dentro del sistema.'
      ]
    },
    {
      title: '2. Información que Recopilamos',
      content: [
        'Datos del Comercio y Cuenta Principal: Razón social, nombre comercial, RTN, dirección física, número de teléfono, correo electrónico del propietario o administrador.',
        'Datos de Personal y Usuarios: Nombres completos, correos electrónicos, roles dentro del sistema (Administrador, Cajero, Cocina, Bodega) y credenciales de autenticación cifradas.',
        'Datos de Clientes del Comercio: Nombres, RTN o documentos de identidad, números de teléfono, direcciones de entrega y saldos de crédito/fiado que el propio comercio registre en su catálogo de clientes.',
        'Datos Transaccionales y Operativos: Registros de ventas, cotizaciones, compras a proveedores, comprobantes de gastos operativos, movimientos de entrada/salida de caja registradora, turnos de trabajo, catálogo de productos, recetas de comida y niveles de inventario.',
        'Datos Técnicos de Conexión: Dirección IP, tipo de navegador, sistema operativo y registros de actividad para auditoría de seguridad y depuración de errores.'
      ]
    },
    {
      title: '3. Finalidad del Tratamiento de los Datos',
      content: [
        'Proveer, mantener y optimizar el funcionamiento del software de punto de venta, inventario y reportería.',
        'Sincronizar datos en tiempo real entre múltiples cajas, terminales de cocina y dispositivos del comercio.',
        'Permitir el funcionamiento en modo sin conexión (offline) y su posterior conciliación automática al restablecerse la red.',
        'Generar reportes contables, resúmenes Z de caja registradora y cálculo de comisiones para el Usuario.',
        'Brindar asistencia técnica, soporte al cliente y resolver incidencias operativas reportadas durante la fase Beta.',
        'Notificar al Usuario sobre eventos relevantes del sistema (alertas de stock bajo, vencimiento de rangos fiscales SAR).'
      ]
    },
    {
      title: '4. Confidencialidad y No Comercialización de Datos',
      content: [
        'MiCuadre no vende, no alquila, no comercializa ni cede a terceros la información comercial ni las bases de datos de clientes registradas por el Usuario.',
        'Toda la información transaccional (volumen de ventas, precios de costo, márgenes de ganancia y listas de clientes) es de propiedad exclusiva del comercio suscriptor y se considera información confidencial de negocio.'
      ]
    },
    {
      title: '5. Seguridad y Aislamiento de la Información (Multi-Tenancy)',
      content: [
        'Los datos se transmiten mediante protocolos seguros y cifrados utilizando HTTPS con certificados SSL/TLS modernos.',
        'La base de datos opera bajo una arquitectura de seguridad por inquilinos (Multi-Tenant Row-Level Security - RLS), lo que garantiza que los datos de un comercio se encuentren estrictamente aislados y sean inaccesibles para otros comercios registrados en la plataforma.',
        'Las contraseñas y códigos PIN de acceso se almacenan utilizando algoritmos de hashing criptográfico unidireccional y nunca se guardan en texto plano.'
      ]
    },
    {
      title: '6. Proveedores de Infraestructura',
      content: [
        'Para asegurar alta disponibilidad y rendimiento, MiCuadre utiliza proveedores internacionales de infraestructura en la nube (como Supabase y servicios de alojamiento en centros de datos seguros).',
        'Estos proveedores cumplen con estándares rigurosos de seguridad física y lógica y procesan la información únicamente conforme a las instrucciones técnicas de MiCuadre.'
      ]
    },
    {
      title: '7. Conservación y Eliminación de Datos',
      content: [
        'La información del comercio se mantendrá activa mientras la suscripción esté vigente.',
        'En caso de que el Usuario decida cancelar su cuenta o finalizar su participación en el programa Beta, podrá solicitar la exportación de sus catálogos y el borrado definitivo de sus registros transaccionales en un plazo no mayor a 30 días hábiles posteriores a la solicitud formal.'
      ]
    },
    {
      title: '8. Contacto para Asuntos de Privacidad',
      content: [
        'Para consultas, solicitudes de rectificación o eliminación de datos relacionados con esta Política, el Usuario puede dirigirse al canal de soporte oficial habilitado para la fase Beta: soporte@micuadre.app.'
      ]
    }
  ]
};

export const BETA_DISCLAIMER: LegalDocument = {
  id: 'beta',
  title: 'Descargo de Responsabilidad de Fase Beta',
  subtitle: 'Condiciones de Participación y Pruebas Públicas de Software',
  lastUpdated: 'Octubre 2026',
  sections: [
    {
      title: '1. Aviso de Versión Beta',
      content: [
        'Bienvenido al Programa Beta de MiCuadre. Esta versión previa está diseñada para validar nuevas funcionalidades y optimizar el rendimiento en entornos reales de negocio.',
        'Al utilizar la plataforma, usted reconoce y acepta que el software puede experimentar actualizaciones frecuentes, ajustes técnicos o interrupciones temporales del servicio.',
        'El sistema se suministra para apoyar la operación de su negocio mientras optimizamos su desempeño.'
      ]
    },
    {
      title: '2. Obligación de Respaldo Contable',
      content: [
        'Recomendamos enfáticamente realizar cierres de turno regulares e imprimir o exportar sus comprobantes de venta, arqueos y reportes contables periódicamente.',
        'La custodia de comprobantes físicos y la conciliación contable externa son responsabilidad del establecimiento comercial durante el período de prueba.'
      ]
    },
    {
      title: '3. Cumplimiento Fiscal Autónomo',
      content: [
        'Como usuario, usted es el único responsable de la verificación y cumplimiento de sus obligaciones fiscales ante el SAR (solicitud y vigencia de CAI, rangos de facturación autorizados y cálculo de impuestos).',
        'MiCuadre no actúa como agente fiscal ni auditor tributario del contribuyente.'
      ]
    }
  ]
};

export const COOKIES_STORAGE_POLICY: LegalDocument = {
  id: 'cookies',
  title: 'Política de Cookies y Almacenamiento Local',
  subtitle: 'Uso de LocalStorage e IndexedDB para Operatividad Offline',
  lastUpdated: 'Octubre 2026',
  sections: [
    {
      title: '1. ¿Qué tecnologías utilizamos?',
      content: [
        'MiCuadre no utiliza cookies publicitarias ni herramientas de rastreo invasivo de terceros.',
        'La plataforma utiliza tecnologías estándar de almacenamiento en el navegador del Usuario para posibilitar su funcionamiento:',
        'Almacenamiento Local (Local Storage): Se emplea para mantener activa la sesión del cajero o administrador de forma segura sin solicitar credenciales en cada recarga de pantalla, y para recordar preferencias de visualización (por ejemplo, la caja registradora asignada a ese computador o el filtro de catálogo seleccionado).',
        'Base de Datos Local (IndexedDB): Permite el funcionamiento sin internet (Modo Offline). Almacena temporalmente los productos, comandas de cocina y ventas realizadas mientras el terminal carece de conexión a la red, garantizando que el cobro no se detenga. Una vez restablecido el internet, los datos locales se sincronizan automáticamente con la nube y el almacenamiento local se actualiza.'
      ]
    },
    {
      title: '2. Control por parte del Usuario',
      content: [
        'El Usuario puede limpiar el almacenamiento local o la memoria caché de su navegador en cualquier momento desde las opciones de configuración de su explorador web.',
        'Importante: Vaciar estos datos locales mientras tenga transacciones pendientes de sincronizar en modo offline podría provocar la pérdida irreversible de dichas operaciones no sincronizadas.'
      ]
    }
  ]
};

export const ALL_LEGAL_DOCS: Record<string, LegalDocument> = {
  terms: TERMS_AND_CONDITIONS,
  privacy: PRIVACY_POLICY,
  beta: BETA_DISCLAIMER,
  cookies: COOKIES_STORAGE_POLICY
};
