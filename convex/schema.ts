import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Family Circles table for group code invites
  families: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    createdBy: v.id("users"),
  }).index("by_code", ["inviteCode"]),

  // User membership mapping inside family circles
  familyMembers: defineTable({
    familyId: v.id("families"),
    userId: v.id("users"),
    role: v.string(), // "admin" | "member"
  })
    .index("by_family", ["familyId"])
    .index("by_user", ["userId"]),

  // Telemetry table linked to user and family with reverse geocoded address
  telemetry: defineTable({
    userId: v.id("users"),
    familyId: v.optional(v.id("families")),
    name: v.string(),
    avatar: v.string(),
    lat: v.number(),
    lng: v.number(),
    locationName: v.optional(v.string()), // Area, City, State, Pincode
    accuracy: v.number(),
    speed: v.union(v.number(), v.null()),
    heading: v.union(v.number(), v.null()),
    batteryLevel: v.union(v.number(), v.null()),
    isCharging: v.boolean(),
    ringerMode: v.union(v.literal("Normal"), v.literal("Silent"), v.literal("Vibrate")),
    networkStatus: v.string(),
    isEmergency: v.boolean(),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_family", ["familyId"]),
});
