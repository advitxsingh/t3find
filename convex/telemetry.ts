import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get currently authenticated user profile
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Update user profile name and image avatar URL
export const updateProfile = mutation({
  args: {
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const finalAvatar = args.avatarUrl?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(args.name)}&background=d97706&color=ffffff&bold=true`;

    await ctx.db.patch(userId, {
      name: args.name,
      image: finalAvatar,
    });

    // Also update existing telemetry entry if present
    const existingTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingTelemetry) {
      await ctx.db.patch(existingTelemetry._id, {
        name: args.name,
        avatar: finalAvatar,
      });
    }
  },
});

// Get user's current family circle
export const getMyFamily = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) return null;

    const family = await ctx.db.get(membership.familyId);
    return family;
  },
});

// Create a new family group with a unique invite code
export const createFamily = mutation({
  args: {
    familyName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate random 6-character uppercase invite code (e.g., T3-X89A)
    const code = "T3-" + Math.random().toString(36).substring(2, 7).toUpperCase();

    const familyId = await ctx.db.insert("families", {
      name: args.familyName,
      inviteCode: code,
      createdBy: userId,
    });

    await ctx.db.insert("familyMembers", {
      familyId,
      userId,
      role: "admin",
    });

    return { familyId, inviteCode: code };
  },
});

// Join an existing family using an invite code
export const joinFamilyWithCode = mutation({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const cleanCode = args.inviteCode.trim().toUpperCase();

    const family = await ctx.db
      .query("families")
      .withIndex("by_code", (q) => q.eq("inviteCode", cleanCode))
      .first();

    if (!family) {
      throw new Error("Invalid family invite code. Please double check and try again.");
    }

    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingMembership) {
      if (existingMembership.familyId === family._id) {
        return { familyId: family._id, name: family.name };
      }
      // Update membership to new family
      await ctx.db.patch(existingMembership._id, { familyId: family._id });
    } else {
      await ctx.db.insert("familyMembers", {
        familyId: family._id,
        userId,
        role: "member",
      });
    }

    // Update familyId in user's telemetry entry
    const existingTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingTelemetry) {
      await ctx.db.patch(existingTelemetry._id, { familyId: family._id });
    }

    return { familyId: family._id, name: family.name };
  },
});

// Get real-time live telemetry of all family members in user's circle
export const getFamilyMesh = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      // If user hasn't joined a family circle yet, return only their own telemetry
      const myTelemetry = await ctx.db
        .query("telemetry")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      return myTelemetry ? [myTelemetry] : [];
    }

    // Get all user memberships in this family
    const familyMemberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_family", (q) => q.eq("familyId", membership.familyId))
      .collect();

    const familyUserIds = familyMemberships.map((m) => m.userId);

    // Fetch telemetry records for all family members
    const allTelemetry = await ctx.db.query("telemetry").collect();
    return allTelemetry.filter((t) => familyUserIds.includes(t.userId));
  },
});

// Update live GPS location and device status
export const updateTelemetry = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    accuracy: v.number(),
    speed: v.union(v.number(), v.null()),
    heading: v.union(v.number(), v.null()),
    batteryLevel: v.union(v.number(), v.null()),
    isCharging: v.boolean(),
    ringerMode: v.union(v.literal("Normal"), v.literal("Silent"), v.literal("Vibrate")),
    networkStatus: v.string(),
    isEmergency: v.boolean(),
    locationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User record not found");

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const existing = await ctx.db
      .query("telemetry")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const userName = user.name || user.email || "Family Member";
    const userAvatar = user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=d97706&color=ffffff&bold=true`;

    const telemetryData = {
      userId,
      familyId: membership?.familyId,
      name: userName,
      avatar: userAvatar,
      lat: args.lat,
      lng: args.lng,
      locationName: args.locationName || existing?.locationName || "Locating address...",
      accuracy: args.accuracy,
      speed: args.speed,
      heading: args.heading,
      batteryLevel: args.batteryLevel,
      isCharging: args.isCharging,
      ringerMode: args.ringerMode,
      networkStatus: args.networkStatus,
      isEmergency: args.isEmergency,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, telemetryData);
    } else {
      await ctx.db.insert("telemetry", telemetryData);
    }
  },
});
