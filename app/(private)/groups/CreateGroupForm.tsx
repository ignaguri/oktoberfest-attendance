import { createGroup } from "./actions";

// TODO: use Formik
export const CreateGroupForm = () => {
  return (
    <form action={createGroup} className="space-y-2">
      <h3 className="text-xl font-semibold">Create a New Group</h3>
      <input
        type="text"
        name="groupName"
        placeholder="Group Name"
        className="w-full p-2 border rounded-lg"
        required
      />
      <input
        type="password"
        name="password"
        placeholder="Group Password"
        className="w-full p-2 border rounded-lg"
        required
      />
      <button type="submit" className="button-inverse">
        Create Group
      </button>
    </form>
  );
};
