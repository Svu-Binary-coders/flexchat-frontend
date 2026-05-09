import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Settings, X, Loader2 } from "lucide-react";
import api from "@/lib/axios";

interface User {
  _id: string;
  userName: string;
  profilePicture?: string;
  customId?: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  myId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreateGroup: (groupData: any) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  myId,
  onCreateGroup,


}) => {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // Group Settings
  const [settings, setSettings] = useState({
    isAdminOnlyMessaging: false,
    isAdminInvitationsAllowed: false,
    inviteViaURL: true,
    canEditGroupInfo: true,
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(`/chats/search?q=${searchQuery}`);
        if (response?.data?.success && Array.isArray(response.data.users)) {
          const filteredResults = response.data.users.filter(
            (user: User) => user._id !== myId,
          );
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, myId]);

  const toggleUserSelection = (user: User) => {
    const isSelected = selectedUsers.some((u) => u._id === user._id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleSubmit = () => {
    if (!groupName.trim()) return;
    if (selectedUsers.length < 2) return;
    const participantIds = Array.from(
      new Set([myId, ...selectedUsers.map((u) => u._id)]),
    );

    const groupData = {
      name: groupName,
      description: description,
      participantIds: participantIds, 
      groupSettings: settings,
    };

    onCreateGroup(groupData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-950">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Create New Group
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 overflow-y-auto">
          <div className="space-y-6 py-4">
            {/* Group Name & Description */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Friends Club"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Description
                </label>
                <Textarea
                  placeholder="What is this group about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none bg-slate-50 dark:bg-slate-900"
                  rows={2}
                />
              </div>
            </div>

            {/* Participants Section */}
            <div className="space-y-3">
              <label className="text-sm font-semibold flex justify-between items-center">
                <span>
                  Add Participants <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-slate-500 font-normal">
                  {selectedUsers.length} selected (Min. 2)
                </span>
              </label>

              {/* Search API Input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search contacts by name..."
                  className="pl-9 pr-9 bg-slate-50 dark:bg-slate-900"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Selected Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {/* Default "You" Badge */}
                <Badge
                  variant="default"
                  className="pl-2 pr-3 py-1 flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  <span className="text-xs font-semibold">You (Admin)</span>
                </Badge>

                {selectedUsers.map((user) => (
                  <Badge
                    key={user._id}
                    variant="secondary"
                    className="pl-1 pr-2 py-1 flex items-center gap-1.5 rounded-full"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={user.profilePicture} />
                      <AvatarFallback className="text-[10px]">
                        {user.userName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">
                      {user.userName.split(" ")[0]}
                    </span>
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer hover:text-red-500"
                      onClick={() => toggleUserSelection(user)}
                    />
                  </Badge>
                ))}
              </div>

              {/* Search Results / User Checkboxes */}
              {searchQuery.trim() && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-[180px] overflow-y-auto mt-2">
                  {isSearching ? (
                    <p className="p-4 text-center text-sm text-slate-500">
                      Searching...
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-500">
                      No users found for &#34;{searchQuery}&#34;
                    </p>
                  ) : (
                    searchResults.map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                        onClick={() => toggleUserSelection(user)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profilePicture} />
                            <AvatarFallback>{user.userName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium leading-none">
                              {user.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              ID: {user.customId}
                            </span>
                          </div>
                        </div>
                        <Checkbox
                          checked={selectedUsers.some(
                            (u) => u._id === user._id,
                          )}
                          onCheckedChange={() => toggleUserSelection(user)}
                          onClick={(e) => e.stopPropagation()} // প্রিভেন্ট ডাবল ক্লিক ইস্যু
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Group Settings (Same as before) */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-slate-500" />
                Group Settings
              </h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="setting-admin-msg"
                    checked={settings.isAdminOnlyMessaging}
                    onCheckedChange={(c) =>
                      setSettings({ ...settings, isAdminOnlyMessaging: !!c })
                    }
                  />
                  <label
                    htmlFor="setting-admin-msg"
                    className="text-sm cursor-pointer select-none leading-none"
                  >
                    Only Admins can send messages
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="setting-admin-msg"
                    checked={settings.isAdminInvitationsAllowed}
                    onCheckedChange={(c) =>
                      setSettings({
                        ...settings,
                        isAdminInvitationsAllowed: !!c,
                      })
                    }
                  />
                  <label
                    htmlFor="setting-admin-msg"
                    className="text-sm cursor-pointer select-none leading-none"
                  >
                    Only Admins can send invitations
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="setting-admin-msg"
                    checked={settings.canEditGroupInfo}
                    onCheckedChange={(c) =>
                      setSettings({
                        ...settings,
                        canEditGroupInfo: !!c,
                      })
                    }
                  />
                  <label
                    htmlFor="setting-admin-msg"
                    className="text-sm cursor-pointer select-none leading-none"
                  >
                    Only Admins can edit group info
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="setting-admin-msg"
                    checked={settings.inviteViaURL}
                    onCheckedChange={(c) =>
                      setSettings({ ...settings, inviteViaURL: !!c })
                    }
                  />
                  <label
                    htmlFor="setting-admin-msg"
                    className="text-sm cursor-pointer select-none leading-none"
                  >
                    Invite via URL
                  </label>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!groupName.trim() || selectedUsers.length < 2}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;
