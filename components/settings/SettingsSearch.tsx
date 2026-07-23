"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Paintbrush,
  Type,
  Moon,
  Shield,
  Lock,
  Bell,
  Smartphone,
  KeyRound,
  Database,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
const SEARCH_GROUPS = [
  {
    heading: "Appearance & Typography",
    items: [
      { label: "Text Size & Font Style", icon: Type, subPage: "appearance" },
      { label: "Theme (Dark/Light Mode)", icon: Moon, subPage: "appearance" },
      { label: "Chat Bubble Style", icon: Paintbrush, subPage: "appearance" },
    ],
  },
  {
    heading: "Security & Privacy",
    items: [
      { label: "Chat Lock & Passcode", icon: Lock, subPage: "chat-lock" },
      { label: "Privacy & Visibility", icon: Shield, subPage: "privacy" },
      {
        label: "Two-Step Verification (2FA)",
        icon: KeyRound,
        subPage: "security",
      },
    ],
  },
  {
    heading: "General Settings",
    items: [
      { label: "Notifications & Sounds", icon: Bell, subPage: "notifications" },
      { label: "Data & Storage Usage", icon: Database, subPage: "data" },
      { label: "Linked Devices", icon: Smartphone, subPage: "devices" },
    ],
  },
];

export function SettingsSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigateToSetting = (subPage: string) => {
    setOpen(false);
    router.push(`/chat?page=settings&subPage=${subPage}`);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between bg-slate-100 dark:bg-slate-800/50 text-sm text-slate-500 rounded-xl px-4 py-2.5 border border-transparent hover:border-sky-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/30"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <span>Search settings...</span>
        </div>
        <kbd className="inline-flex h-5 items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden border-none shadow-2xl rounded-2xl w-[90vw] max-w-2xl fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
          <DialogTitle className="sr-only">Search Settings</DialogTitle>
          <Command className="w-full h-full overflow-hidden rounded-lg">
            <CommandInput placeholder="Search settings (e.g., theme, lock)..." />

            <CommandList className="max-h-[50vh] overflow-y-auto">
              <CommandEmpty>No settings found.</CommandEmpty>

              {SEARCH_GROUPS.map((group, groupIndex) => (
                <React.Fragment key={group.heading}>
                  <CommandGroup heading={group.heading}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <CommandItem
                          key={item.label}
                          onSelect={() => navigateToSetting(item.subPage)}
                          className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-md flex items-center"
                        >
                          <Icon className="mr-2 h-4 w-4 text-slate-500" />
                          <span>{item.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  {groupIndex < SEARCH_GROUPS.length - 1 && (
                    <CommandSeparator />
                  )}
                </React.Fragment>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
