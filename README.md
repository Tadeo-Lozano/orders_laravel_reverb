# Pedidos Refaccionaria

Sistema de pedidos en tiempo real para una refaccionaria usando Laravel 12, MySQL, Laravel Reverb y Laravel Echo.

## Clientes

- `vendedor`: captura una o varias piezas, cantidad y descripcion.
- `almacen`: recibe pedidos nuevos con alerta sonora y puede marcar `Entregado`, `Sin existencia` o `Existencia insuficiente`.
- `monitor`: ve todo el historial, quien solicito y quien atendio cada pedido.

## Stack

- PHP 8.2+
- Laravel 12
- MySQL
- Laravel Reverb
- Laravel Echo + Pusher JS
- Vite

## Configuracion local

1. Copia `.env.example` a `.env` si todavia no existe.
2. Inicia MySQL.
   En Laragon puedes hacerlo desde la interfaz o con:

```powershell
Start-Process -FilePath "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\laragon\bin\mysql\mysql-8.4.3-winx64\my.ini" -WindowStyle Hidden
```

3. Crea la base si hace falta:

```powershell
& "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS pedidos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

4. Instala dependencias:

```bash
composer install
npm install
```

5. Ejecuta migraciones:

```bash
php artisan migrate
```

6. Levanta toda la aplicacion:

```bash
composer dev
```

Eso inicia:

- `php artisan serve`
- `php artisan reverb:start`
- `php artisan queue:listen`
- `php artisan pail`
- `npm run dev`

## Ngrok

Si vas a exponer la app con ngrok, no conviene usar `composer dev` porque eso levanta Vite en modo caliente y el navegador remoto intentara cargar assets desde `localhost:5173`.

Usa mejor:

```bash
composer dev:ngrok
```

Eso compila assets estaticos y levanta Laravel, Reverb y la cola sin depender de Vite HMR.

Si quieres que el tiempo real por Reverb funcione tambien desde fuera de tu red, necesitas un segundo tunel ngrok apuntando al puerto `8080`.

## Rutas principales

- `/`
- `/vendedor`
- `/almacen`
- `/monitor`

## Pruebas

```bash
php artisan test
```
