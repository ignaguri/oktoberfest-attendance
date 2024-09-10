"use client";

import { useState, Fragment } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import Image from "next/image";

import ShareIcon from "@/public/icons/share-ios-icon.svg";

interface ShareButtonProps {
  groupName: string;
  groupPassword: string;
}

const ICON_SIZE = 20;

export default function ShareButton({
  groupName,
  groupPassword,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  const shareText = `Join my group on the ProstCounter app! ${APP_URL}\nName: ${groupName}\nGroup password: ${groupPassword}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const shareViaWhatsApp = () => {
    const encodedText = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encodedText}`, "_blank");
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="button-inverse px-2 py-2 flex items-center"
        onClick={() => setIsOpen(true)}
        title="Share group"
      >
        <Image
          width={ICON_SIZE}
          height={ICON_SIZE}
          src={ShareIcon}
          alt="Share group"
          style={{ height: ICON_SIZE, width: ICON_SIZE }}
          priority
        />
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsOpen(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Share Group
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Choose how you&apos;d like to share the group information:
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 items-center">
                    <button
                      type="button"
                      className="button w-fit"
                      onClick={copyToClipboard}
                    >
                      {copied ? "Copied!" : "Copy Invite Text"}
                    </button>
                    <button
                      type="button"
                      className="button-inverse w-fit"
                      onClick={shareViaWhatsApp}
                    >
                      Share via WhatsApp
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
