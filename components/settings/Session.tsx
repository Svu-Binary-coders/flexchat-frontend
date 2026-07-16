// // components/settings/SessionList.tsx
// "use client";

// import { useState } from "react";
// import { Monitor, Smartphone, Globe, Clock, LogOut } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
//   AlertDialogTrigger,
// } from "@/components/ui/alert-dialog";

// interface Session {
//   sessionId: string;
//   device: string;
//   location: string;
//   ip: string;
//   lastLogin: string;
//   isCurrentSession: boolean;
// }

// const dummySessions: Session[] = [
//   {
//     sessionId: "sess_abc123",
//     device: "Chrome on Windows",
//     location: "Dhaka, Bangladesh",
//     ip: "103.123.45.67",
//     lastLogin: new Date("2026-03-29T10:30:00Z").toISOString(),
//     isCurrentSession: true,
//   },
//   {
//     sessionId: "sess_def456",
//     device: "Safari on iPhone",
//     location: "Chittagong, Bangladesh",
//     ip: "103.123.45.68",
//     lastLogin: new Date("2026-03-28T08:00:00Z").toISOString(),
//     isCurrentSession: false,
//   },
//   {
//     sessionId: "sess_ghi789",
//     device: "Firefox on MacOS",
//     location: "Sylhet, Bangladesh",
//     ip: "103.123.45.69",
//     lastLogin: new Date("2026-03-27T15:45:00Z").toISOString(),
//     isCurrentSession: false,
//   },
// ];

// //  Device icon
// const DeviceIcon = ({ device }: { device: string }) => {
//   if (
//     device.toLowerCase().includes("iphone") ||
//     device.toLowerCase().includes("android")
//   ) {
//     return <Smartphone className="h-5 w-5 text-sky-500" />;
//   }
//   if (
//     device.toLowerCase().includes("windows") ||
//     device.toLowerCase().includes("macos") ||
//     device.toLowerCase().includes("linux")
//   ) {
//     return <Monitor className="h-5 w-5 text-sky-500" />;
//   }
//   return <Globe className="h-5 w-5 text-sky-500" />;
// };

// //  Time since
// const timeSince = (dateStr: string): string => {
//   const diff = Date.now() - new Date(dateStr).getTime();
//   const h = Math.floor(diff / 3600000);
//   const d = Math.floor(h / 24);
//   if (d > 0) return `${d}d ago`;
//   if (h > 0) return `${h}h ago`;
//   return "just now";
// };

// //  Single Session Card
// const SessionCard = ({
//   session,
//   onDelete,
// }: {
//   session: Session;
//   onDelete: (id: string) => void;
// }) => {
//   return (
//     <div
//       className={cn(
//         "flex items-center gap-4 rounded-xl border p-4 transition-colors",
//         session.isCurrentSession
//           ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
//           : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50",
//       )}
//     >
//       {/* Icon */}
//       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50">
//         <DeviceIcon device={session.device} />
//       </div>

//       {/* Info */}
//       <div className="flex-1 min-w-0">
//         <div className="flex items-center gap-2 flex-wrap">
//           <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
//             {session.device}
//           </p>
//           {session.isCurrentSession && (
//             <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-900 dark:text-sky-300 text-[10px] px-2 py-0">
//               current
//             </Badge>
//           )}
//         </div>
//         <div className="flex items-center gap-2 mt-1 flex-wrap">
//           <span className="text-xs text-slate-500 dark:text-slate-400">
//             {session.location}
//           </span>
//           <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
//           <span className="text-xs text-slate-500 dark:text-slate-400">
//             {session.ip}
//           </span>
//           <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
//           <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
//             <Clock className="h-3 w-3" />
//             {timeSince(session.lastLogin)}
//           </span>
//         </div>
//       </div>

//       {/* Action */}
//       {session.isCurrentSession ? (
//         <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
//           This device
//         </span>
//       ) : (
//         <AlertDialog>
//           <AlertDialogTrigger asChild>
//             <Button
//               variant="ghost"
//               size="sm"
//               className="shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
//             >
//               <LogOut className="h-4 w-4 mr-1.5" />
//               Sign out
//             </Button>
//           </AlertDialogTrigger>
//           <AlertDialogContent>
//             <AlertDialogHeader>
//               <AlertDialogTitle>Sign out this session?</AlertDialogTitle>
//               <AlertDialogDescription>
//                 {session.device} — {session.location} will be signed out.
//               </AlertDialogDescription>
//             </AlertDialogHeader>
//             <AlertDialogFooter>
//               <AlertDialogCancel>Cancel</AlertDialogCancel>
//               <AlertDialogAction
//                 onClick={() => onDelete(session.sessionId)}
//                 className="bg-red-500 hover:bg-red-600"
//               >
//                 Sign out
//               </AlertDialogAction>
//             </AlertDialogFooter>
//           </AlertDialogContent>
//         </AlertDialog>
//       )}
//     </div>
//   );
// };

// //  Main Component
// export default function SessionList() {
//   const [sessions, setSessions] = useState<Session[]>(dummySessions);

//   const otherSessions = sessions.filter((s) => !s.isCurrentSession);

//   const handleDelete = async (sessionId: string) => {
//     try {
//       // API call
//       await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
//       setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
//     } catch {
//       console.error("Delete failed");
//     }
//   };

//   const handleDeleteAll = async () => {
//     try {
//       // API call
//       await fetch("/api/sessions", { method: "DELETE" });
//       setSessions((prev) => prev.filter((s) => s.isCurrentSession));
//     } catch {
//       console.error("Delete all failed");
//     }
//   };

//   return (
//     <div className="space-y-4">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
//             Active sessions
//           </p>
//           <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
//             {sessions.length} session{sessions.length !== 1 ? "s" : ""}
//           </p>
//         </div>

//         {otherSessions.length > 0 && (
//           <AlertDialog>
//             <AlertDialogTrigger asChild>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-950/30"
//               >
//                 <LogOut className="h-3.5 w-3.5 mr-1.5" />
//                 Sign out all others
//               </Button>
//             </AlertDialogTrigger>
//             <AlertDialogContent>
//               <AlertDialogHeader>
//                 <AlertDialogTitle>
//                   Sign out all other sessions?
//                 </AlertDialogTitle>
//                 <AlertDialogDescription>
//                   {otherSessions.length} other session
//                   {otherSessions.length !== 1 ? "s" : ""} will be signed out.
//                   Your current session will remain active.
//                 </AlertDialogDescription>
//               </AlertDialogHeader>
//               <AlertDialogFooter>
//                 <AlertDialogCancel>Cancel</AlertDialogCancel>
//                 <AlertDialogAction
//                   onClick={handleDeleteAll}
//                   className="bg-red-500 hover:bg-red-600"
//                 >
//                   Sign out all
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </AlertDialogContent>
//           </AlertDialog>
//         )}
//       </div>

//       {/* Session Cards */}
//       <div className="space-y-2.5">
//         {sessions.map((session) => (
//           <SessionCard
//             key={session.sessionId}
//             session={session}
//             onDelete={handleDelete}
//           />
//         ))}
//       </div>

//       {/* Empty state */}
//       {sessions.length === 0 && (
//         <div className="flex flex-col items-center justify-center py-10 text-center">
//           <Monitor className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
//           <p className="text-sm text-slate-400">No active sessions</p>
//         </div>
//       )}
//     </div>
//   );
// }
