import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { extractFields } from "../src/field-extractor.js";

const sdl = /* GraphQL */ `
  directive @auth on FIELD_DEFINITION

  """A user of the system."""
  type User {
    id: ID!
    """The user's email address."""
    email: String!
    orders(limit: Int): [Order!]!
  }

  interface Node {
    id: ID!
  }

  type Order implements Node {
    id: ID!
    total: Float!
  }

  input CreateUserInput {
    email: String!
    name: String
  }

  enum Status {
    ACTIVE
    INACTIVE
  }

  scalar DateTime

  union SearchResult = User | Order

  type Query {
    user(id: ID!): User
  }

  type Mutation {
    deleteUser(id: ID!): Boolean @auth @deprecated(reason: "use deleteUserV2")
  }
`;

describe("extractFields", () => {
  const schema = buildSchema(sdl);
  const fields = extractFields(schema);

  it("includes object type fields with descriptions", () => {
    const email = fields.find((f) => f.path === "User.email");
    expect(email).toBeDefined();
    expect(email?.description).toBe("The user's email address.");
    expect(email?.parentKind).toBe("OBJECT");
    expect(email?.fieldType).toBe("String!");
  });

  it("captures args for object fields", () => {
    const orders = fields.find((f) => f.path === "User.orders");
    expect(orders?.args).toEqual([{ name: "limit", type: "Int" }]);
  });

  it("includes interface type fields", () => {
    expect(fields.some((f) => f.path === "Node.id")).toBe(true);
  });

  it("includes input object fields with empty args", () => {
    const name = fields.find((f) => f.path === "CreateUserInput.name");
    expect(name).toBeDefined();
    expect(name?.parentKind).toBe("INPUT_OBJECT");
    expect(name?.args).toEqual([]);
  });

  it("excludes enum, scalar, and union types", () => {
    expect(fields.some((f) => f.parentType === "Status")).toBe(false);
    expect(fields.some((f) => f.parentType === "DateTime")).toBe(false);
    expect(fields.some((f) => f.parentType === "SearchResult")).toBe(false);
  });

  it("excludes introspection types", () => {
    expect(fields.some((f) => f.parentType.startsWith("__"))).toBe(false);
  });

  it("captures null description when absent", () => {
    const total = fields.find((f) => f.path === "Order.total");
    expect(total?.description).toBeNull();
  });

  it("stringifies NonNull list types correctly", () => {
    const orders = fields.find((f) => f.path === "User.orders");
    expect(orders?.fieldType).toBe("[Order!]!");
  });

  it("captures directive names applied to a field, in declaration order", () => {
    const deleteUser = fields.find((f) => f.path === "Mutation.deleteUser");
    expect(deleteUser?.directives).toEqual(["auth", "deprecated"]);
  });

  it("returns an empty directives array for fields with none", () => {
    const email = fields.find((f) => f.path === "User.email");
    expect(email?.directives).toEqual([]);
  });
});
