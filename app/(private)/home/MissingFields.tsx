import Link from "next/link";

import type { FC } from "react";

interface MissingFieldProps {
  label: string;
  icon: string;
  link: string;
}

const MissingField: FC<MissingFieldProps> = ({ label, icon, link }) => {
  return (
    <div className="flex items-center space-x-4 p-3 bg-gray-100 rounded-lg">
      <span className="text-xl" role="img" aria-label={label}>
        {icon}
      </span>
      <span className="flex-grow text-gray-700">{label}</span>
      <Link
        href={link}
        className="text-xl cursor-pointer hover:opacity-70 transition-opacity"
        aria-label="Edit"
      >
        ✏️
      </Link>
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
  return (
    <>
      <p className="text-sm text-center text-gray-600 mb-2">
        Let&apos;s complete your profile to get started:
      </p>
      <div className="space-y-4 mb-4">
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
    </>
  );
};

export default MissingFields;
