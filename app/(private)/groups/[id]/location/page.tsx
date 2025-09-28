import { GroupMembersMap } from "@/components/LocationSharing";
import { Link } from "next-view-transitions";

export default async function GroupLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center justify-center mb-4">
        <h2 className="text-2xl font-bold">Group&apos;s live location</h2>
      </div>

      <GroupMembersMap radiusMeters={1000} />

      <div className="mt-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Share your location to see nearby group members and let them see you.
        </p>
        <p className="text-xs text-muted-foreground">
          Control which groups can see your location in your{" "}
          <Link href="/profile" className="underline hover:no-underline">
            profile settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
