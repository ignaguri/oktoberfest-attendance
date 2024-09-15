import Link from "next/link";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, UserCheck, Image as ImageIcon, Edit } from "lucide-react";

interface MissingFieldProps {
  label: string;
  icon: JSX.Element;
  link: string;
}

const MissingField: FC<MissingFieldProps> = ({ label, icon, link }) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2 justify-center items-center">
        <span className="text-xl" role="img" aria-label={label}>
          {icon}
        </span>
        <span className="flex-grow text-gray-700">{label}</span>
      </div>
      <Button asChild variant="ghost">
        <Link href={link} aria-label="Edit">
          <Edit className="w-4 h-4" />
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
            <MissingField
              label="Name"
              icon={<User className="w-4 h-4" />}
              link="/profile"
            />
          )}
          {missingFields.username && (
            <MissingField
              label="Username"
              icon={<UserCheck className="w-4 h-4" />}
              link="/profile"
            />
          )}
            <MissingField
              label="Profile picture"
              icon={<ImageIcon className="w-4 h-4" />}
              link="/profile"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MissingFields;
