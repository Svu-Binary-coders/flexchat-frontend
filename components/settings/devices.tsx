/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  Smartphone,
  Globe,
  LogOut,
  ShieldCheck,
  Loader2,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { toast } from "sonner";
import { timeFormatFn } from "@/lib/dateHelper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// 🔴 আমাদের UI এর জন্য ইন্টারফেস
interface DeviceSession {
  sessionId: string;
  os: string;
  browser: string;
  deviceType: "desktop" | "mobile" | "web" | string;
  lastLogin: string;
  lastLogout: string | null;
  location: {
    city: string;
    country: string;
    region: string;
    timezone: string;
  } | null;
  ip: string;
  isActiveSession: boolean;
  isCurrentDevice: boolean;
}

export default function DeviceList() {
  const queryClient = useQueryClient();

  const {
    data: devices,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["active-devices"],
    queryFn: async () => {
      const response = await api.get("/auth/devices");

      const rawSessions = response.data.devices;

      return rawSessions.map((session: any) => ({
        sessionId: session.session_id,
        os: session.device_info.os,
        browser: session.device_info.browser,
        deviceType: session.device_info.deviceType,
        lastLogin: session.login_time,
        lastLogout: null,
        location: session.location,
        ip: session.ip_address,
        isActiveSession: session.status === "active",
        isCurrentDevice: session.isCurrentSession,
      })) as DeviceSession[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { mutate: logoutDevice, isPending: isLoggingOutSingle } = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/devices/${sessionId}`);
    },
    onSuccess: () => {
      toast.success("Device logged out successfully!");
      queryClient.invalidateQueries({ queryKey: ["active-devices"] });
    },
    onError: () => {
      toast.error("Failed to log out device.");
    },
  });

  const { mutate: logoutAllOthers, isPending: isLoggingOutAll } = useMutation({
    mutationFn: async () => {
      await api.delete("/auth/delete-all");
    },
    onSuccess: () => {
      toast.success("All other devices logged out successfully!");
      queryClient.invalidateQueries({ queryKey: ["active-devices"] });
    },
    onError: () => {
      toast.error("Failed to log out other devices.");
    },
  });

  const otherDevicesCount =
    devices?.filter((d) => !d.isCurrentDevice).length || 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-slate-100 rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-4" />
        <p className="text-sm text-slate-500">
          Loading your active sessions...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-red-100 bg-red-50/50 rounded-2xl dark:bg-red-950/10 dark:border-red-900/30">
        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Connection Error
        </h3>
        <p className="text-xs text-slate-500 text-center max-w-xs mb-4">
          We couldn&#39;t load your active devices right now. Please try again.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["active-devices"] })
          }
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <ShieldCheck className="text-emerald-500 h-6 w-6" /> Logged in
            Devices
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            You are currently logged in to {devices?.length || 0} device
            {(devices?.length || 0) !== 1 ? "s" : ""}.
          </p>
        </div>

        {/* Log out all others Button */}
        {otherDevicesCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:bg-transparent dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 shadow-sm transition-all"
                disabled={isLoggingOutAll}
              >
                {isLoggingOutAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Sign out all others
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Sign out all other sessions?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately log you out of {otherDevicesCount} other
                  device{otherDevicesCount !== 1 ? "s" : ""}. Your current
                  session on this device will remain active.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => logoutAllOthers()}
                  className="rounded-xl bg-red-500 hover:bg-red-600 text-white border-transparent"
                >
                  Sign out all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Devices List */}
      <div className="flex flex-col gap-3">
        {devices?.map((device) => (
          <div
            key={device.sessionId}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-all duration-200 hover:shadow-sm",
              device.isCurrentDevice
                ? "bg-sky-50/50 border-sky-200 dark:bg-sky-900/10 dark:border-sky-800"
                : "bg-white border-slate-200 dark:bg-slate-900/40 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
            )}
          >
            <div className="flex items-center gap-4 min-w-0">
              {/* Device Icon */}
              <div
                className={cn(
                  "p-3 rounded-full shrink-0 flex items-center justify-center h-12 w-12",
                  device.isCurrentDevice
                    ? "bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                )}
              >
                {device.deviceType === "mobile" ? (
                  <Smartphone className="h-5 w-5" />
                ) : device.deviceType === "desktop" ? (
                  <Monitor className="h-5 w-5" />
                ) : (
                  <Globe className="h-5 w-5" />
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[15px] text-slate-800 dark:text-slate-200 flex items-center gap-2 truncate">
                  {device.os} — {device.browser}
                  {device.isCurrentDevice && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/50">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Current
                    </span>
                  )}
                </span>

                {/* Location & IP */}
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                  {device.location?.city &&
                    device.location?.city !== "Localhost" && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                        {device.location.city}, {device.location.country} •
                      </>
                    )}
                  {device.location?.city === "Localhost" && (
                    <>
                      <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                      Local Network •
                    </>
                  )}
                  IP: {device.ip}
                </span>

                {/* Last Login Time */}
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                  Last active:{" "}
                  {device.lastLogin
                    ? timeFormatFn(device.lastLogin, "12h")
                    : "Unknown"}
                </span>
              </div>
            </div>

            {device.isCurrentDevice ? (
              <div className="shrink-0 pl-2">
                <span className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium text-sky-600 bg-sky-100/50 rounded-xl dark:bg-sky-900/30 dark:text-sky-400 select-none border border-sky-100 dark:border-sky-800/50 cursor-default">
                  This Device
                </span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoutDevice(device.sessionId)}
                disabled={isLoggingOutSingle}
                className="shrink-0 text-slate-500 hover:text-red-600 border-slate-200 hover:border-red-200 hover:bg-red-50 dark:border-slate-800 dark:hover:border-red-900/30 dark:hover:bg-red-950/30 ml-3 h-9 rounded-xl transition-colors"
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {devices?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
          <Monitor className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
            No active sessions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You are not currently logged in to any devices.
          </p>
        </div>
      )}
    </div>
  );
}
