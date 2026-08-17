# 🐹 CuycitoGO - Ecosistema de Gestión de Streaming & Tienda Digital

Bienvenido a **CuycitoGO**, una plataforma integral diseñada para la venta, control financiero, administración de cuentas raíz y gestión de perfiles de servicios de streaming (Netflix, Spotify, Disney+, Max, Prime Video, etc.) con portal exclusivo de clientes, notas/post-its en tiempo real, creador de combos de ofertas y tienda pública sincronizada con Firebase.

---

## 🏛️ Organigrama & Arquitectura del Sistema

```mermaid
flowchart TD
    subgraph ADMIN["👨‍💼 PANEL ADMINISTRADOR (dashboard.html)"]
        A1["⚡ Operación Rápida (Venta/Compra)"]
        A2["👑 Cuentas Raíz & Asignación de Perfiles"]
        A3["📊 Finanzas & Rentabilidad en Tiempo Real"]
        A4["👥 Accesos Tienda & Auto-Generador de Claves (Nick = Nombre)"]
        A5["📦 Catálogo Web & Autocompletado con Suma Multi-Cuenta"]
        A6["🎁 Creador de Combos Especiales (Suma de Servicios & Ahorro %)"]
        A7["📌 Posits / Notas Rápidas (Colores, Fijados & Firestore)"]
        A8["🔒 Control de Visibilidad de Credenciales"]
    end

    subgraph FIREBASE["🔥 BACKEND & BASE DE DATOS (Firebase Cloud)"]
        F1[("users\n(Clientes, Nicknames & Accesos)")]
        F2[("subscriptions\n(Cuentas & Perfiles)")]
        F3[("masterAccounts\n(Cuentas Raíz & Capacidad)")]
        F4[("store_catalog\n(Catálogo, Combos, linkedService & Stock)")]
        F5[("postits\n(Notas, Recordatorios & Pendientes)")]
        F6[("history\n(Libro Mayor)")]
        F7["Storage\n(Imágenes de Productos y Combos)"]
    end

    subgraph CLIENTE["👤 CLIENTES & TIENDA PÚBLICA"]
        C1["🛒 index.html\n(Tienda, Combos con Ahorro %, Stock Sumado & Carrito)"]
        C2["🔐 login-cliente.html\n(Acceso con Teléfono y Clave)"]
        C3["📋 perfil.html\n(Portal VIP: Modificar Nickname, Servicios Activos)"]
    end

    subgraph EXTERNAL["📲 COMUNICACIÓN & PEDIDOS"]
        W1["WhatsApp Oficial: +51 991735344\n(Detalle de Combos, Productos & Total de la Suma)"]
        P1["Yape / Plin / Transferencias"]
    end

    %% Conexiones Administrador a Base de Datos
    A1 -->|Guarda| F2
    A1 -->|Registra| F6
    A2 -->|Administra cupos| F3
    A2 -->|Vincula perfil| F2
    A4 -->|Crea/Edita accesos| F1
    A5 -->|Publica productos| F4
    A6 -->|Publica combos con ventajas y % ahorro| F4
    A6 -->|Sube imágenes| F7
    A7 -->|Sincroniza notas| F5
    A8 -->|Controla visibilidad| F3
    A8 -->|Controla visibilidad| F2

    %% Conexiones Base de Datos a Cliente
    F4 -.->|Lectura de catálogo & combos| C1
    F1 -.->|Autenticación| C2
    F1 -.->|Datos de Perfil & Modificación de Nickname| C3
    F2 -.->|Lectura de cuentas activas/vencidas| C3
    F3 -.->|Cálculo de cupos disponibles sumados| C1

    %% Conexiones con WhatsApp
    C1 -->|Envía carrito con desglose de combos| W1
    C3 -->|Solicita renovación / soporte| W1
    A4 -->|Envía credenciales de acceso| W1
    W1 --> P1
```

---

## 📜 Historial de Versiones & Changelog

### 🚀 **Versión 4.3 (Notas Posit en Panel & Creador de Combos de Ofertas)**
- **📌 Apartado de Posit / Notas Rápidas en el Dashboard**:
  - Ubicado en el panel lateral derecho, directamente debajo de las alertas de vencimiento.
  - Sincronizado en tiempo real con la colección `postits` de Firebase Firestore.
  - Paleta de 5 colores temáticos (Amarillo, Verde, Celeste, Rosa, Morado), fijado de notas prioritarias arriba (Pin 📌), edición en caliente y eliminación.
- **🎁 Creador Dinámico de Combos de Servicios & Ofertas**:
  - Modal especializado accesible desde el botón *Crear Combo Oferta 🔥* en Catálogo Web.
  - **Suma de Servicios Modular**: Permite agregar múltiples plataformas (`Servicio 1 + Servicio 2 + ...`).
  - **Cálculo Automático en Vivo**:
    * Suma de Precios Regulares Unitarios (Tachado).
    * Precio Oferta Especial del Combo.
    * Ahorro en Dinero (S/) y Porcentaje de Ahorro (`% DE AHORRO`).
  - **Ventajas Comerciales**: Lista de ventajas destacadas (perfiles privados, calidad 4K, garantía 30 días, PIN independiente).
  - **Diseño de Tarjetas Combo en Tienda Pública ([index.html](file:///c:/Users/Cristhian/Desktop/CuzcitoGo/index.html))**:
    * Badge de `-XX% COMBO AHORRO`.
    * Desglose de servicios incluidos y precios unitarios.
    * Integración completa con el carrito y mensajes de WhatsApp (+51 991735344).

---

### 🚀 **Versión 4.2 (Suma Multi-Cuenta Raíz en Catálogo & Nickname Inicial)**
- **📦 Carga Automática Avanzada & Suma de Cuentas Raíz en Catálogo**:
  - Suma de cupos libres entre múltiples cuentas de la misma plataforma (ej. 2 Cuentas Netflix = 7 cupos libres).
- **👤 Tratamiento de Nickname y Nombre en Clientes**:
  - Nickname = Nombre completo por defecto; en el portal del cliente el Nombre Real es fijo y solo se edita el Nickname.

---

### 🚀 **Versión 4.1 (Visibilidad de Credenciales & WhatsApp Oficial)**
- **🔒 Política Estricta de Visibilidad de Credenciales**:
  - Credenciales ocultas para clientes si la cuenta matriz no tiene permiso activado.
- **📲 Integración de WhatsApp Oficial (+51 991735344)**.

---

### 🚀 **Versión 4.0 (Seguridad, Auto-Accesos y Stock en Vivo)**
- **⚡ Generador Automático de Accesos Web con Teléfono Aleatorio**: Generación de credenciales en 1-clic.

---

© 2026 **CuycitoGO** • Todos los derechos reservados.
