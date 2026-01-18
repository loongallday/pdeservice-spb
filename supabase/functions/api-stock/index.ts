/**
 * @fileoverview Stock Management API Edge Function - Inventory control system
 * @module api-stock
 *
 * @description
 * Fast, atomic stock operations with full audit trail.
 * Supports both quantity-based items and serial-tracked items.
 *
 * Stock Features:
 * - Multi-location inventory (warehouse, vehicle, technician)
 * - Quantity tracking for consumables
 * - Serial number tracking for equipment
 * - Movement history with full audit trail
 * - Low stock alerts
 * - Ticket consumption linking
 *
 * Movement Types:
 * - Receive: Add stock from supplier
 * - Transfer: Move between locations
 * - Consume: Use stock for ticket work
 * - Adjust: Manual stock corrections
 * - Deploy: Install serial item at customer site
 * - Return: Recover serial item from customer
 *
 * @endpoints
 * ## Dashboard
 * - GET    /dashboard                    - Stock overview
 *
 * ## Location Management
 * - GET    /locations                    - List all locations
 * - GET    /locations/:id                - Get location details
 * - GET    /locations/:id/items          - Get items at location
 * - POST   /locations                    - Create location
 * - PUT    /locations/:id                - Update location
 * - DELETE /locations/:id                - Delete location
 *
 * ## Item Management (Quantity-based)
 * - GET    /items                        - List all items
 * - GET    /items/search                 - Search items
 * - GET    /items/low-stock              - Get low stock alerts
 * - GET    /items/:id                    - Get item details
 * - GET    /items/:id/movements          - Get item movement history
 * - POST   /items/:id/adjust             - Adjust item quantity
 *
 * ## Stock Movements
 * - POST   /receive                      - Receive new stock
 * - POST   /transfer                     - Transfer between locations
 * - POST   /tickets/:ticketId/consume    - Consume stock for ticket
 *
 * ## Serial Tracking
 * - GET    /serials                      - List all serials
 * - GET    /serials/search               - Search serials
 * - GET    /serials/by-serial/:serialNo  - Get by serial number
 * - GET    /serials/:id                  - Get serial details
 * - GET    /serials/:id/movements        - Get serial movement history
 * - POST   /serials/receive              - Receive new serial items
 * - POST   /serials/:id/transfer         - Transfer serial item
 * - POST   /serials/:id/deploy           - Deploy to customer
 * - POST   /serials/:id/return           - Return from customer
 * - POST   /serials/:id/defective        - Mark as defective
 * - POST   /serials/:id/status           - Update status
 *
 * @auth All endpoints require JWT authentication
 * @table main_stock_locations - Stock location definitions
 * @table main_stock_items - Quantity-based inventory
 * @table child_stock_movements - Quantity movement history
 * @table main_stock_serial_items - Serial-tracked items
 * @table child_stock_serial_movements - Serial movement history
 * @table jct_ticket_stock_items - Ticket-stock consumption links
 */

import { handleCORS } from '../_shared/cors.ts';
import { authenticate } from '../_shared/auth.ts';
import { error } from '../_shared/response.ts';
import { handleError } from '../_shared/error.ts';

// Location handlers
import { listLocations } from './handlers/locations/list.ts';
import { getLocation } from './handlers/locations/get.ts';
import { createLocation } from './handlers/locations/create.ts';
import { updateLocation } from './handlers/locations/update.ts';
import { deleteLocation } from './handlers/locations/delete.ts';

// Item handlers
import { listItems } from './handlers/items/list.ts';
import { getItem } from './handlers/items/get.ts';
import { searchItems } from './handlers/items/search.ts';
import { getLowStock } from './handlers/items/lowStock.ts';
import { getItemsByLocation } from './handlers/items/getByLocation.ts';

// Movement handlers
import { receiveStock } from './handlers/movements/receive.ts';
import { transferStock } from './handlers/movements/transfer.ts';
import { adjustStock } from './handlers/movements/adjust.ts';
import { getMovementHistory } from './handlers/movements/history.ts';
import { consumeStock } from './handlers/movements/consume.ts';

// Dashboard handler
import { getDashboard } from './handlers/dashboard.ts';

// Serial handlers
import { listSerials } from './handlers/serials/list.ts';
import { getSerial, getSerialBySerialNo } from './handlers/serials/get.ts';
import { searchSerials } from './handlers/serials/search.ts';
import { receiveSerials } from './handlers/serials/receive.ts';
import { transferSerial } from './handlers/serials/transfer.ts';
import { deploySerial } from './handlers/serials/deploy.ts';
import { returnSerial } from './handlers/serials/return.ts';
import { updateSerialStatus, markSerialDefective } from './handlers/serials/updateStatus.ts';
import { getSerialMovements } from './handlers/serials/movements.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    const { employee } = await authenticate(req);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-stock');
    const segments = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    // Route: GET /dashboard
    if (method === 'GET' && segments[0] === 'dashboard' && segments.length === 1) {
      return await getDashboard(req, employee);
    }

    // Route: GET /locations
    if (method === 'GET' && segments[0] === 'locations' && segments.length === 1) {
      return await listLocations(req, employee);
    }

    // Route: GET /locations/:id
    if (method === 'GET' && segments[0] === 'locations' && segments.length === 2) {
      return await getLocation(req, employee, segments[1]);
    }

    // Route: GET /locations/:id/items
    if (method === 'GET' && segments[0] === 'locations' && segments.length === 3 && segments[2] === 'items') {
      return await getItemsByLocation(req, employee, segments[1]);
    }

    // Route: POST /locations
    if (method === 'POST' && segments[0] === 'locations' && segments.length === 1) {
      return await createLocation(req, employee);
    }

    // Route: PUT /locations/:id
    if (method === 'PUT' && segments[0] === 'locations' && segments.length === 2) {
      return await updateLocation(req, employee, segments[1]);
    }

    // Route: DELETE /locations/:id
    if (method === 'DELETE' && segments[0] === 'locations' && segments.length === 2) {
      return await deleteLocation(req, employee, segments[1]);
    }

    // Route: GET /items
    if (method === 'GET' && segments[0] === 'items' && segments.length === 1) {
      return await listItems(req, employee);
    }

    // Route: GET /items/search
    if (method === 'GET' && segments[0] === 'items' && segments[1] === 'search') {
      return await searchItems(req, employee);
    }

    // Route: GET /items/low-stock
    if (method === 'GET' && segments[0] === 'items' && segments[1] === 'low-stock') {
      return await getLowStock(req, employee);
    }

    // Route: GET /items/:id
    if (method === 'GET' && segments[0] === 'items' && segments.length === 2 && !['search', 'low-stock'].includes(segments[1])) {
      return await getItem(req, employee, segments[1]);
    }

    // Route: GET /items/:id/movements
    if (method === 'GET' && segments[0] === 'items' && segments.length === 3 && segments[2] === 'movements') {
      return await getMovementHistory(req, employee, segments[1]);
    }

    // Route: POST /items/:id/adjust
    if (method === 'POST' && segments[0] === 'items' && segments.length === 3 && segments[2] === 'adjust') {
      return await adjustStock(req, employee, segments[1]);
    }

    // Route: POST /receive
    if (method === 'POST' && segments[0] === 'receive' && segments.length === 1) {
      return await receiveStock(req, employee);
    }

    // Route: POST /transfer
    if (method === 'POST' && segments[0] === 'transfer' && segments.length === 1) {
      return await transferStock(req, employee);
    }

    // Route: POST /tickets/:ticketId/consume
    if (method === 'POST' && segments[0] === 'tickets' && segments.length === 3 && segments[2] === 'consume') {
      return await consumeStock(req, employee, segments[1]);
    }

    // =============================================
    // SERIAL TRACKING ROUTES
    // =============================================

    // Route: GET /serials
    if (method === 'GET' && segments[0] === 'serials' && segments.length === 1) {
      return await listSerials(req, employee);
    }

    // Route: GET /serials/search?q=...
    if (method === 'GET' && segments[0] === 'serials' && segments[1] === 'search') {
      return await searchSerials(req, employee);
    }

    // Route: GET /serials/by-serial/:serialNo
    if (method === 'GET' && segments[0] === 'serials' && segments[1] === 'by-serial' && segments.length === 3) {
      return await getSerialBySerialNo(req, employee, segments[2]);
    }

    // Route: GET /serials/:id
    if (method === 'GET' && segments[0] === 'serials' && segments.length === 2 && !['search', 'by-serial'].includes(segments[1])) {
      return await getSerial(req, employee, segments[1]);
    }

    // Route: GET /serials/:id/movements
    if (method === 'GET' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'movements') {
      return await getSerialMovements(req, employee, segments[1]);
    }

    // Route: POST /serials/receive
    if (method === 'POST' && segments[0] === 'serials' && segments[1] === 'receive' && segments.length === 2) {
      return await receiveSerials(req, employee);
    }

    // Route: POST /serials/:id/transfer
    if (method === 'POST' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'transfer') {
      return await transferSerial(req, employee, segments[1]);
    }

    // Route: POST /serials/:id/deploy
    if (method === 'POST' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'deploy') {
      return await deploySerial(req, employee, segments[1]);
    }

    // Route: POST /serials/:id/return
    if (method === 'POST' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'return') {
      return await returnSerial(req, employee, segments[1]);
    }

    // Route: POST /serials/:id/defective
    if (method === 'POST' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'defective') {
      return await markSerialDefective(req, employee, segments[1]);
    }

    // Route: POST /serials/:id/status
    if (method === 'POST' && segments[0] === 'serials' && segments.length === 3 && segments[2] === 'status') {
      return await updateSerialStatus(req, employee, segments[1]);
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
