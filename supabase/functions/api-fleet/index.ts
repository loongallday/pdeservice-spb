/**
 * Fleet API Edge Function
 * Reads vehicle data from database (synced by api-fleet-sync)
 * Manages garage/base locations and route history
 */

import { handleCORS } from '../_shared/cors.ts';
import { error } from '../_shared/response.ts';
import { authenticate } from '../_shared/auth.ts';
import { handleError } from '../_shared/error.ts';
import {
  listFleet,
  getVehicle,
  updateVehicle,
  getVehicleRoute,
  listGarages,
  createGarage,
  updateGarage,
  deleteGarage,
} from './handlers/fleet.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCORS(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const { employee } = await authenticate(req);

    // Route to appropriate handler
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      return error('Invalid URL', 400);
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const functionIndex = pathParts.indexOf('api-fleet');
    const relativePath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : [];
    const method = req.method;

    switch (method) {
      case 'GET':
        // GET / - List all vehicles
        if (relativePath.length === 0) {
          return await listFleet(req, employee);
        }

        // GET /garages - List all garages
        if (relativePath.length === 1 && relativePath[0] === 'garages') {
          return await listGarages(req, employee);
        }

        // GET /:id/route - Get route history
        if (relativePath.length === 2 && relativePath[1] === 'route') {
          const vehicleId = relativePath[0];
          return await getVehicleRoute(req, employee, vehicleId);
        }

        // GET /:id - Get single vehicle
        if (relativePath.length === 1) {
          const id = relativePath[0];
          return await getVehicle(req, employee, id);
        }
        break;

      case 'POST':
        // POST /garages - Create a new garage
        if (relativePath.length === 1 && relativePath[0] === 'garages') {
          return await createGarage(req, employee);
        }
        break;

      case 'PUT':
        // PUT /garages/:id - Update a garage
        if (relativePath.length === 2 && relativePath[0] === 'garages') {
          const garageId = relativePath[1];
          return await updateGarage(req, employee, garageId);
        }

        // PUT /:id - Update vehicle (driver name override)
        if (relativePath.length === 1 && relativePath[0] !== 'garages') {
          const vehicleId = relativePath[0];
          return await updateVehicle(req, employee, vehicleId);
        }
        break;

      case 'DELETE':
        // DELETE /garages/:id - Delete a garage
        if (relativePath.length === 2 && relativePath[0] === 'garages') {
          const garageId = relativePath[1];
          return await deleteGarage(req, employee, garageId);
        }
        break;
    }

    return error('Not found', 404);
  } catch (err) {
    const { message, statusCode } = handleError(err);
    return error(message, statusCode);
  }
});
