import Link from "next/link";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MissingFieldProps {
  label: string;
  icon: string;
  link: string;
}

const MissingField: FC<MissingFieldProps> = ({ label, icon, link }) => {
  return (
    <div className="flex justify-between">
      <div className="flex gap-2 justify-center">
        <span className="text-xl" role="img" aria-label={label}>
          {icon}
        </span>
        <span className="flex-grow text-gray-700">{label}</span>
      </div>
      <Button asChild variant="ghost">
        <Link href={link} aria-label="Edit">
          ✏️
        </Link>
      </Button>
    </div>
  );
};

interface MissingFieldsProps {
  missingFields: {
    full_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

const MissingFields: FC<MissingFieldsProps> = ({ missingFields }) => {
  if (Object.values(missingFields).length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {missingFields.full_name && (
            <MissingField label="Name" icon="👤" link="/profile" />
          )}
          {missingFields.username && (
            <MissingField label="Username" icon="👤" link="/profile" />
          )}
          {missingFields.avatar_url && (
            <MissingField label="Profile picture" icon="🖼️" link="/profile" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MissingFields;
