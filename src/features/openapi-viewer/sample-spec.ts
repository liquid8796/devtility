/**
 * Compact petstore-like OpenAPI 3.0 sample spec (2 tags, 5 endpoints,
 * requestBody, $refs, enums) embedded for the "Sample spec" button.
 */

const SAMPLE_SPEC_DOC = {
  openapi: "3.0.3",
  info: {
    title: "PetShop API",
    version: "1.4.2",
    description:
      "API mẫu quản lý thú cưng và đơn nhận nuôi — dùng để thử OpenAPI Viewer. " +
      "A demo pet-adoption API used to try out the OpenAPI viewer.",
  },
  servers: [{ url: "https://api.petshop.dev/v1" }],
  tags: [
    { name: "pets", description: "Quản lý thú cưng / Manage pets" },
    { name: "orders", description: "Đơn nhận nuôi / Adoption orders" },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/pets": {
      get: {
        tags: ["pets"],
        summary: "List pets",
        description: "Returns a paged list of pets, optionally filtered by status.",
        operationId: "listPets",
        parameters: [
          {
            name: "status",
            in: "query",
            required: true,
            description: "Adoption status filter",
            schema: { type: "string", enum: ["available", "pending", "adopted"] },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Page size (max 100)",
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "A paged list of pets",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["pets"],
        summary: "Create a pet",
        operationId: "createPet",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NewPet" } },
          },
        },
        responses: {
          "201": {
            description: "Pet created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
          },
          "400": { description: "Invalid input" },
        },
      },
    },
    "/pets/{petId}": {
      get: {
        tags: ["pets"],
        summary: "Get a pet by id",
        operationId: "getPet",
        parameters: [
          {
            name: "petId",
            in: "path",
            required: true,
            description: "Pet identifier",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "The pet",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
          },
          "404": { description: "Pet not found" },
        },
      },
      delete: {
        tags: ["pets"],
        summary: "Delete a pet",
        operationId: "deletePet",
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "204": { description: "Deleted" },
          "404": { description: "Pet not found" },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["orders"],
        summary: "Place an adoption order",
        operationId: "placeOrder",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
        },
        responses: {
          "201": {
            description: "Order placed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
          },
          "422": { description: "Pet is not available" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name", "species"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Mèo Mun" },
          species: { type: "string", enum: ["cat", "dog", "bird"] },
          age: { type: "integer", minimum: 0, example: 2 },
          adopted: { type: "boolean", default: false },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      NewPet: {
        type: "object",
        required: ["name", "species"],
        properties: {
          name: { type: "string", example: "Cún Bông" },
          species: { type: "string", enum: ["cat", "dog", "bird"] },
          age: { type: "integer", minimum: 0 },
        },
      },
      Order: {
        type: "object",
        required: ["items"],
        properties: {
          id: { type: "string", format: "uuid" },
          items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
          status: { type: "string", enum: ["placed", "approved", "completed"], default: "placed" },
          placedAt: { type: "string", format: "date-time" },
        },
      },
      OrderItem: {
        type: "object",
        required: ["petId"],
        properties: {
          petId: { type: "string", format: "uuid" },
          quantity: { type: "integer", default: 1 },
          note: { type: "string", example: "Giao cuối tuần" },
        },
      },
    },
  },
};

export const SAMPLE_SPEC = JSON.stringify(SAMPLE_SPEC_DOC, null, 2);
