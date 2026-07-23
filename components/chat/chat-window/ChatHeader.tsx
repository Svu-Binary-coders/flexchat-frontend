"use client";
import { Phone, Video, MoreVertical, Search, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/stores/chatStore";

export default function ChatHeader({
  onProfileClick,
}: {
  onProfileClick: () => void;
}) {
  const { activeContact } = useChatStore();
  if (!activeContact) return null;

  const initials = activeContact.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const goBack = () => {
    useChatStore.setState({ activeContact: null });
  };

  return (
    <header className="flex items-center gap-3 px-5 py-3 md:text-sm bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 h-[65px] transition-colors duration-200 shadow-sm dark:shadow-md">
      
      {/* Back Button (Only visible on mobile) */}
      <button
        onClick={goBack}
        className="md:hidden h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" />
      </button>

      {/* User Info & Avatar */}
      <button
        onClick={onProfileClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left group"
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700">
            <AvatarImage src={activeContact.profile_image} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-slate-200 text-sm font-semibold transition-colors">
              {initials}
            </AvatarFallback>
          </Avatar>
          {activeContact.isOnline && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 transition-colors" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {activeContact.name
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </p>
          <p className="text-xs flex items-center gap-1 mt-0.5">
            {activeContact.isOnline ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-500">Active now</span>
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Offline</span>
            )}
          </p>
        </div>
      </button>

      {/* Action Buttons Container */}
      <div className="flex items-center gap-1 md:gap-2">
        
        {/* Search Button: Hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Audio Call: Always visible */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Phone className="h-4 w-4" />
        </Button>

        {/* Video Call: Hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Video className="h-4 w-4" />
        </Button>

        {/* 3-Dot (More) Button with Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          
          {/* Dropdown List - Light and Dark Theme Handled */}
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-lg dark:shadow-xl">
            <DropdownMenuItem className="hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
              View Profile
            </DropdownMenuItem>
            
            {/* Mobile-only options inside dropdown */}
            <DropdownMenuItem className="md:hidden hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
              <Video className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              Video Call
            </DropdownMenuItem>
            <DropdownMenuItem className="md:hidden hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
              <Search className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              Search Chat
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
            <DropdownMenuItem className="hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
              Mute Notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
              Clear Chat
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />
            <DropdownMenuItem className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 focus:bg-red-50 dark:focus:bg-slate-700 focus:text-red-600 dark:focus:text-red-400 cursor-pointer font-medium">
              Block User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}