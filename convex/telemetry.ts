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

    const finalAvatar = args.avatarUrl?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(args.name)}&background=0f172a&color=ffffff&bold=true`;

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

    const existingMembership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingMembership) {
      if (existingMembership.familyId === family._id) {
        return { familyId: family._id, name: family.name };
      }
      await ctx.db.patch(existingMembership._id, { familyId: family._id });
    } else {
      await ctx.db.insert("familyMembers", {
        familyId: family._id,
        userId,
        role: "member",
      });
    }

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
      const myTelemetry = await ctx.db
        .query("telemetry")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      return myTelemetry ? [myTelemetry] : [];
    }

    const familyMemberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_family", (q) => q.eq("familyId", membership.familyId))
      .collect();

    const familyUserIds = familyMemberships.map((m) => m.userId);

    const allTelemetry = await ctx.db.query("telemetry").collect();
    return allTelemetry.filter((t) => familyUserIds.includes(t.userId));
  },
});

// Remote Siren Trigger Mutation (Ring target phone loudly)
export const triggerRemoteSiren = mutation({
  args: {
    targetUserId: v.id("users"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const targetTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .first();

    if (targetTelemetry) {
      await ctx.db.patch(targetTelemetry._id, { isSirenActive: args.active });
    }
  },
});

// Request Remote Sync Ping Mutation (Signals circle members' devices to immediately transmit fresh location & battery)
export const requestCircleSync = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) return;

    const familyMemberships = await ctx.db
      .query("familyMembers")
      .withIndex("by_family", (q) => q.eq("familyId", membership.familyId))
      .collect();

    const now = Date.now();
    for (const member of familyMemberships) {
      const memberTel = await ctx.db
        .query("telemetry")
        .withIndex("by_user", (q) => q.eq("userId", member.userId))
        .first();

      if (memberTel) {
        await ctx.db.patch(memberTel._id, { requestRefreshPing: now });
      }
    }
  },
});

// Trigger Impact / Crash Alert
export const triggerCrashAlert = mutation({
  args: {
    isCrash: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const telemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (telemetry) {
      await ctx.db.patch(telemetry._id, { isCrashDetected: args.isCrash, isEmergency: args.isCrash });
    }
  },
});

// Update live GPS location, device status, and store location history timeline
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
    isCrashDetected: v.optional(v.boolean()),
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
    const userAvatar = user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0f172a&color=ffffff&bold=true`;

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
      isCrashDetected: args.isCrashDetected || false,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, telemetryData);
    } else {
      await ctx.db.insert("telemetry", telemetryData);
    }

    // Insert point into locationHistory timeline table
    await ctx.db.insert("locationHistory", {
      userId,
      lat: args.lat,
      lng: args.lng,
      locationName: args.locationName,
      speed: args.speed,
      timestamp: Date.now(),
    });
  },
});

// Safe Zones & Geofencing Mutations/Queries
export const getSafeZones = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) return [];

    return await ctx.db
      .query("safeZones")
      .withIndex("by_family", (q) => q.eq("familyId", membership.familyId))
      .collect();
  },
});

export const addSafeZone = mutation({
  args: {
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    radiusMeters: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("familyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) throw new Error("Join or create a Circle first to set Safe Zones");

    return await ctx.db.insert("safeZones", {
      familyId: membership.familyId,
      name: args.name,
      lat: args.lat,
      lng: args.lng,
      radiusMeters: args.radiusMeters,
      createdBy: userId,
    });
  },
});

export const deleteSafeZone = mutation({
  args: {
    zoneId: v.id("safeZones"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const zone = await ctx.db.get(args.zoneId);
    if (!zone) return;

    await ctx.db.delete(args.zoneId);
  },
});

// OTA In-App Update Queries & Mutations
export const getLatestRelease = query({
  args: {},
  handler: async (ctx) => {
    const releases = await ctx.db.query("appReleases").order("desc").collect();
    return releases.length > 0 ? releases[0] : null;
  },
});

export const publishRelease = mutation({
  args: {
    version: v.string(),
    downloadUrl: v.string(),
    releaseNotes: v.string(),
    isMandatory: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Delete ALL old releases first so only the latest ever exists
    const existing = await ctx.db.query("appReleases").collect();
    for (const r of existing) {
      await ctx.db.delete(r._id);
    }
    return await ctx.db.insert("appReleases", {
      version: args.version,
      downloadUrl: args.downloadUrl,
      releaseNotes: args.releaseNotes,
      isMandatory: args.isMandatory,
      createdAt: Date.now(),
    });
  },
});
