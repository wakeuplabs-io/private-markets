/**
 * @fileoverview Index route
 * Simple index route that returns API information
 *
 * @module interfaces/http/routes/index
 */

import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { createRouter } from "../../../lib/create-app";

/**
 * Index route configuration
 */
const indexRoute = createRoute({
  path: "/",
  method: "get",
  tags: ["Index"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Prediction Market Builder API"),
      "API Information",
    ),
  },
});

/**
 * Index router with handler
 */
const indexRouter = createRouter();

indexRouter.openapi(indexRoute, (c) => {
  return c.json(
    { message: "Prediction Market Builder API v1.0" },
    HttpStatusCodes.OK
  );
});

export default indexRouter;