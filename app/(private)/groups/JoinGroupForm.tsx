import { joinGroup } from "./actions";

// TODO: use Formik
export const JoinGroupForm = () => {
  return (
    <form action={joinGroup} className="space-y-2">
      <h3 className="text-xl font-semibold">Join a Group</h3>
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
        Join Group
      </button>
    </form>
  );
};
