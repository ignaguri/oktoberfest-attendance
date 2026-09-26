import { MyTaggedPhotos } from "@/components/photo-tags/MyTaggedPhotos";

import AccountForm from "./AccountForm";

export default function ProfilePage() {
  return (
    <>
      <AccountForm />
      <div className="mx-auto w-full max-w-lg px-4 pb-8">
        <MyTaggedPhotos />
      </div>
    </>
  );
}
