"use client";
import { Loader2, UserPlus, User } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function NewChatModal() {
  const {
    showNewChat,
    closeNewChat,
    newChatId,
    handleNewChatIdChange,
    newChatLoading,
    newChatError,
    newChatPreview,
    createAndOpenChat,
  } = useChatStore();

  return (
    <Dialog open={showNewChat} onOpenChange={(v) => !v && closeNewChat()}>
      <DialogContent className="sm:max-w-md rounded-2xl dark:bg-slate-900 dark:border-slate-800 transition-colors duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
            <UserPlus className="h-5 w-5 text-sky-500 dark:text-sky-400" />
            New Conversation
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            Search by username or @userID
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Input Box */}
          <div className="relative">
            <Input
              value={newChatId}
              onChange={(e) => handleNewChatIdChange(e.target.value)}
              placeholder="Search by name or @id..."
              className="h-11 rounded-xl font-mono text-sm pr-10 transition-colors duration-200
                          border-slate-200 bg-white text-slate-900 placeholder:text-slate-400
                          focus-visible:ring-sky-400 focus-visible:border-sky-400
                          dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500
                          dark:focus-visible:ring-sky-500 dark:focus-visible:border-sky-500"
            />
            {newChatLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" />
            )}
          </div>

          {/* Error Message */}
          {newChatError && (
            <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
              {newChatError}
            </p>
          )}

          {newChatPreview.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {newChatPreview.map((user) => (
                <div
                  key={user.id}
                  onClick={() => createAndOpenChat(user)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors duration-200
                             bg-sky-50 border border-sky-100 hover:bg-sky-100
                             dark:bg-sky-950/30 dark:border-sky-900/50 dark:hover:bg-sky-900/40"
                >
                  <Avatar className="h-10 w-10 border border-sky-200 dark:border-sky-800">
                    <AvatarImage src={user.profile_image || undefined} />
                    <AvatarFallback className="bg-linear-to-br from-sky-400 to-blue-600 text-white text-sm font-semibold">
                      {(user?.name || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {user?.name || "Unknown User"}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                      @{user.user_id}
                    </p>
                  </div>
                  <User className="h-4 w-4 text-sky-400 dark:text-sky-500 shrink-0" />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={closeNewChat}
              className="flex-1 rounded-xl h-10 transition-colors
                         dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
