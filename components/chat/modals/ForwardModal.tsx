"use client";
import { Forward } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function ForwardModal() {
  const { forwardMsg, setForwardMsg, contacts, handleForward } = useChatStore();

  return (
    <Dialog open={!!forwardMsg} onOpenChange={(v) => !v && setForwardMsg(null)}>
      {/* Dialog Content - Dark Mode Background & Border */}
      <DialogContent className="sm:max-w-sm rounded-2xl dark:bg-slate-900 dark:border-slate-800 transition-colors duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
            <Forward className="h-5 w-5 text-sky-500 dark:text-sky-400" />
            Forward Message
          </DialogTitle>
        </DialogHeader>

        {/* Message preview - Dark Mode Classes Added */}
        {forwardMsg && (
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 italic truncate dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-300 transition-colors">
            &#34;{forwardMsg.content}&#34;
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
          Select a contact to forward to:
        </p>

        {/* Contact List */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => handleForward(c.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <Avatar className="h-8 w-8 border border-slate-100 dark:border-slate-700">
                <AvatarImage src={c.profile_image} />
                <AvatarFallback className="bg-linear-to-br from-sky-400 to-blue-600 text-white text-xs font-semibold">
                  {c.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {c.name}
              </span>
              {c.isOnline && (
                <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
              )}
            </button>
          ))}
        </div>

        {/* Cancel Button */}
        <Button
          variant="outline"
          onClick={() => setForwardMsg(null)}
          className="w-full rounded-xl dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
