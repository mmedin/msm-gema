# ADR: Almacenamiento de JWT en localStorage (SEC-07)

> **Estado:** Aceptado  
> **Fecha:** Septiembre 2026  
> **Contexto:** GEMA — Gestión de Eventos Meteorológicos Adversos — Municipalidad de General San Martín

---

## Contexto

El token JWT de autenticación se almacena en `localStorage` del navegador (`frontend/src/api.ts`). Una cookie `httpOnly` + `Secure` + `SameSite=Strict` ofrecería protección superior contra ataques XSS, ya que el token no sería accesible desde JavaScript.

## Decisión

**Se mantiene `localStorage` como mecanismo de almacenamiento del JWT**, complementado con las siguientes mitigaciones:

### Mitigaciones implementadas

1. **Content-Security-Policy (CSP) estricto en Nginx** (`frontend/nginx.conf`):
   - `script-src 'self'`: Solo se ejecutan scripts del propio origen. Esto bloquea la inyección de scripts externos que podrían leer localStorage.
   - `object-src 'none'`: Bloquea plugins (Flash, Java) que podrían bypassear CSP.
   - `base-uri 'self'`: Previene ataques de base tag hijacking.
   - `form-action 'self'`: Previene exfiltración vía formularios.

2. **Helmet en el backend** (`backend/src/index.ts`):
   - Headers de seguridad adicionales en todas las respuestas de la API.

3. **Sanitización de uploads** (SEC-02):
   - Las extensiones de archivos subidos se derivan estrictamente del MIME type verificado, previniendo stored XSS vía archivos `.html` o `.svg` camuflados.

4. **Token de vida corta** (SEC-05):
   - El JWT expira en 2 horas (reducido desde 24h), limitando la ventana de explotación en caso de robo del token.

5. **Verificación de usuario activo en cada request** (SEC-05):
   - Aunque se robe un token, si el administrador desactiva al usuario, el token deja de funcionar en un máximo de 60 segundos.

6. **Bloqueo de archivos ocultos en Nginx**:
   - `location ~ /\. { deny all; }` previene acceso a `.env`, `.git`, etc.

## Riesgo residual

Si un atacante logra ejecutar JavaScript arbitrario en el contexto del origen (bypasseando CSP), podría leer el token de localStorage. Este riesgo es mitigado por:

- La política CSP estricta que bloquea scripts no originarios.
- El tiempo de vida corto del token (2h).
- La verificación de estado activo del usuario.

## Condiciones para reconsiderar

Se debería migrar a cookies `httpOnly` si:

1. La aplicación se expone a internet público sin VPN ni firewall municipal.
2. Se integran scripts de terceros (analytics, widgets, chatbots) que debilitarían CSP.
3. Se descubre una vulnerabilidad XSS en dependencias del frontend (React, Leaflet, etc.) que no pueda mitigarse con CSP.
4. Regulación provincial o nacional exija explícitamente el uso de cookies httpOnly para sistemas gubernamentales.

## Consecuencias

- **Positivo:** Simplicidad de implementación, sin cambios en CORS ni flujo de autenticación.
- **Positivo:** Compatible con el patrón actual de polling con header `Authorization: Bearer`.
- **Negativo:** Riesgo residual aceptado documentado arriba.
