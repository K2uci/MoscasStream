# Las MoscasStream

Catálogo de audiovisuales para tus clientes, funcionando en tu red local.

| Carpeta | Qué es | Guía |
|---|---|---|
| [`app/`](app/README.md) | App Android (Expo SDK 57) que ven los clientes | [app/README.md](app/README.md) |
| [`servidor/`](servidor/README.md) | Servidor en Docker: API, panel de administración, PostgreSQL e importación automática de listados | [servidor/README.md](servidor/README.md) |

## En resumen

1. Enciende el servidor: `servidor\iniciar.bat`. Necesita Docker Desktop.
2. Administra el catálogo en <http://localhost:3000>. Agrega títulos a mano, o en automático buscándolos en TMDb.
3. **Para poblar la app en masa**, deja los listados `.txt` de tus discos en `servidor\importacion`.
   Al arrancar el servidor, se agrega lo que falte y el `.txt` se borra.
4. En cada teléfono o tablet, abre la app, **mantén pulsado el logo** y escribe la dirección que muestra `iniciar.bat`.
