/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";
import { User2 as userProfile } from "lucide-react";
import {
  User,
  Mail,
  MapPin,
  Calendar,
  Camera,
  Loader2,
  Trash2,
  CheckCircle2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IMyDetails } from "@/interface/auth.interface";
import ImageViewerModal from "../profile/ImageViewerModal";

//  Helper Function for Reading File
function readFile(file: File) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), false);
    reader.readAsDataURL(file);
  });
}

//  API calls

async function updateProfile(data: {
  userName?: string;
  location?: { city?: string; country?: string };
  bio?: string;
  website?: string;
}) {
  const res = await axiosInstance.patch("/auth/update-profile", data);
  return res.data;
}

async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);

  const res = await axiosInstance.post("/uploads/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

async function deleteAvatar() {
  const res = await axiosInstance.delete("/uploads/avatar");
  return res.data;
}

//  Inline editable field

function EditableField({
  label,
  value,
  onSave,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    if (draft.trim() === value) {
      setEditing(false);
      return;
    }
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      {editing ? (
        <div className="flex gap-2">
          <Input
            type={type}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-9 text-sm border-sky-300 focus-visible:ring-sky-400"
          />
          <button
            onClick={handleSave}
            className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="group flex items-center justify-between h-9 px-3 rounded-lg border border-slate-200 hover:border-sky-300 bg-white cursor-text transition-all"
        >
          <span className="text-sm text-slate-700">{value || placeholder}</span>
          <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-400 transition-colors" />
        </div>
      )}
    </div>
  );
}

//  Avatar upload zone (With Cropper)

function AvatarUploader({
  src,
  initials,
  isUploading,
  isDeleting,
  onUpload,
  onDelete,
}: {
  src?: string;
  initials: string;
  isUploading: boolean;
  isDeleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [originalFileMeta, setOriginalFileMeta] = useState<{
    name: string;
    type: string;
  } | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const MAX_SIZE_MB = 2;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`File size must be less than ${MAX_SIZE_MB}MB`);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, WEBP, and AVIF formats are allowed");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setOriginalFileMeta({ name: file.name, type: file.type });
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl as string);
      setIsCropping(true);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const showCroppedImage = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedFile = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        originalFileMeta?.name,
        originalFileMeta?.type,
      );
      if (croppedFile) onUpload(croppedFile);
      setIsCropping(false);
      setImageSrc(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image");
    }
  };

  return (
    <>
      <div className="relative group w-fit mx-auto md:mx-0">
        <div className="relative">
          <Avatar className="h-28 w-28 md:h-32 md:w-32 ring-4 ring-white shadow-xl">
            <AvatarImage src={src} />
            <AvatarFallback className="bg-linear-to-br from-sky-400 to-blue-600 text-3xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          {src && (
            <div
              onClick={() => setViewerOpen(true)}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                         transition-opacity cursor-pointer flex items-center justify-center"
            >
              {isUploading ? (
                <Loader2 className="h-7 w-7 text-white animate-spin" />
              ) : (
                <Camera className="h-7 w-7 text-white" />
              )}
            </div>
          )}

          {!src && (
            <div
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                         transition-opacity cursor-pointer flex items-center justify-center"
            >
              {isUploading ? (
                <Loader2 className="h-7 w-7 text-white animate-spin" />
              ) : (
                <Camera className="h-7 w-7 text-white" />
              )}
            </div>
          )}
        </div>

        {src && (
          <div className="absolute -top-1 -right-1 flex flex-col gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="h-7 w-7 rounded-full bg-white border border-slate-200 text-sky-500
                         hover:bg-sky-50 hover:text-sky-600 shadow-md flex items-center
                         justify-content:center transition-all z-10"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
              ) : (
                <Pencil className="h-3.5 w-3.5 mx-auto" />
              )}
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="h-7 w-7 rounded-full bg-white border border-slate-200 text-rose-400
                         hover:bg-rose-50 hover:text-rose-600 shadow-md flex items-center
                         justify-content:center transition-all z-10"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mx-auto" />
              )}
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg, image/png, image/webp, image/avif"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      <ImageViewerModal
        imageUrl={src ?? null}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* Crop Modal */}
      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crop Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="relative h-64 w-full bg-slate-900 rounded-md overflow-hidden my-4">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsCropping(false)}>
              Cancel
            </Button>
            <Button
              onClick={showCroppedImage}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Save Avatar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
//  Main Component

export default function Profile() {
  const { myDetails, setMyDetails } = useAuthStore();
  const queryClient = useQueryClient();
  const initials = myDetails?.name?.slice(0, 2).toUpperCase() || "UN";

  const router = useRouter();

  const gopath = (path: string) => {
    router.push(path);
  };

  //  Mutations
  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      if (myDetails) {
        setMyDetails({ ...myDetails, ...data.user });
      }
      queryClient.setQueryData(["auth"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ...data.user,
        };
      });
      toast.success("Profile updated");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.msg ||
        error?.message ||
        "Failed to update profile";

      toast.error(message);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (data) => {
      // update state with new avatar URL
      if (myDetails) {
        setMyDetails({ ...myDetails, profile_image: data.profilePicture });
      }
      // update the cached auth data so that the new avatar is reflected across the app without refetching
      queryClient.setQueryData(["auth"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          profile_image: data.profilePicture,
        };
      });

      toast.success(data.message || "Avatar updated");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Upload failed";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: (data) => {
      if (myDetails) {
        // avtar delete -> profile pic undefined
        setMyDetails({ ...myDetails, profile_image: undefined });
      }
      // update the cached auth data to remove the avatar URL
      queryClient.setQueryData(["auth"], (old: IMyDetails) => {
        if (!old) return old;
        return {
          ...old,
          profile_image: undefined,
        };
      });
      toast.success("Avatar removed");
    },
    onError: () => toast.error("Delete failed"),
  });

  const checkValidWebsite = (url: string) => {
    if (!url || url.trim() === "") return true;
    let urlToTest = url.trim();

    if (!/^https?:\/\//i.test(urlToTest)) {
      urlToTest = `https://${urlToTest}`;
    }

    try {
      const validUrl = new URL(urlToTest);
      const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      const isValid =
        (validUrl.protocol === "http:" || validUrl.protocol === "https:") &&
        domainRegex.test(validUrl.hostname);

      if (!isValid) {
        toast.error("Please enter a valid URL (e.g., example.com)");
        return false;
      }

      return true;
    } catch {
      toast.error("Please enter a valid URL (e.g., example.com)");
      return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/*  Hero card  */}
      <div className="relative bg-linear-to-br from-sky-50 to-blue-50 rounded-2xl border border-sky-100 p-6 md:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 opacity-[0.07]">
          <User className="h-48 w-48 -translate-y-8 translate-x-8" />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div>
            <AvatarUploader
              src={myDetails?.profile_image}
              initials={initials}
              isUploading={uploadMutation.isPending}
              isDeleting={deleteMutation.isPending}
              onUpload={(file) => uploadMutation.mutate(file)}
              onDelete={() => deleteMutation.mutate()}
            />
          </div>

          <div className="text-center md:text-left space-y-1.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {myDetails?.name
                ? myDetails.name
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")
                : "Unnamed User"}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-sky-500" />
                {myDetails?.email || "Not set"}
              </span>
              <span className="hidden md:block text-slate-300">·</span>
              <span className="text-[10px] font-bold bg-white/80 border border-sky-100 px-2.5 py-1 rounded-full font-mono tracking-tight">
                {myDetails?.user_id || "N/A"}
              </span>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white/80 border border-slate-100 px-2.5 py-1 rounded-full">
                <Calendar className="h-3 w-3" />
                <span className="mx-1">Joined </span>
                {myDetails?.created_at
                  ? new Date(myDetails.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
            <div className="">
              {/* login devices */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => gopath("?page=settings&subPage=devices")}
                className="mt-4 "
              >
                View Login Devices
              </Button>
              {/* manage your Appearance */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => gopath("?page=settings&subPage=appearance")}
                className="mt-2 mx-2"
              >
                Manage Appearance
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/*  Personal info  */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1">
          <User className="h-4 w-4 text-sky-500" />
          <h2 className="text-sm font-bold text-slate-800">Personal Info</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditableField
            label="Username"
            value={myDetails?.name || ""}
            onSave={(val) => updateMutation.mutate({ userName: val })}
          />
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Email Address
            </label>
            <div className="flex h-9 items-center px-3 rounded-lg border border-slate-200 bg-slate-50 gap-2">
              <span className="text-sm text-slate-400 truncate flex-1">
                {myDetails?.email || "Not set"}
              </span>
              <span className="text-[9px] font-bold text-slate-300 uppercase">
                Locked
              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <EditableField
            label="Bio"
            value={myDetails?.bio || ""}
            placeholder="Tell us about yourself"
            onSave={(val) => updateMutation.mutate({ bio: val })}
          />
        </div>
        {/* website */}
        <div className="space-y-1.5">
          <EditableField
            label="Website"
            value={myDetails?.website || ""}
            placeholder="Add website"
            onSave={(val) => {
              if (val && !checkValidWebsite(val)) {
                return;
              }
              updateMutation.mutate({ website: val });
            }}
            // add view button if website exists
          />

          {myDetails?.website && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                const baseUrl = /^https?:\/\//i.test(myDetails.website!)
                  ? myDetails.website
                  : `https://${myDetails.website}`;

                try {
                  const finalUrl = new URL(baseUrl as string);
                  finalUrl.searchParams.set("utm_source", "my_chat_app");
                  finalUrl.searchParams.set("utm_medium", "profile_panel");

                  window.open(finalUrl.toString(), "_blank");
                } catch (e) {
                  window.open(baseUrl, "_blank");
                }
              }}
            >
              View Website
            </Button>
          )}
        </div>

        {/* Location */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-rose-400" /> Location
          </p>
          <div className="grid grid-cols-2 gap-3">
            <EditableField
              label="City"
              value={myDetails?.location?.city || ""}
              placeholder="Add city"
              onSave={(val) =>
                updateMutation.mutate({
                  location: { ...myDetails?.location, city: val },
                })
              }
            />
            <EditableField
              label="Country"
              value={myDetails?.location?.country || ""}
              placeholder="Add country"
              onSave={(val) =>
                updateMutation.mutate({
                  location: { ...myDetails?.location, country: val },
                })
              }
            />
          </div>
        </div>

        {updateMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-sky-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving changes...
          </div>
        )}
      </div>
    </div>
  );
}
