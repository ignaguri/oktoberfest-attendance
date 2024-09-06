// import { useSupabase } from "@/hooks/useSupabase";
// import { useCallback, useEffect, useState } from "react";

// type Attendance = {
//   id: string;
//   date: string;
//   beer_count: number;
// };

// export type UserProfile = {
//   id: string;
//   email: string;
//   name: string;
// };

// export const ProfilePage = () => {
//   const { supabase, user } = useSupabase();
//   const [profile, setProfile] = useState<UserProfile | null>(null);
//   const [attendances, setAttendances] = useState<Attendance[]>([]);
//   const [editMode, setEditMode] = useState(false);
//   const [name, setName] = useState("");

//   const fetchProfile = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("profiles")
//       .select("*")
//       .eq("id", user?.id)
//       .single();

//     if (error) {
//       console.error("Error fetching profile", error);
//       return;
//     }

//     if (data) {
//       setProfile(data);
//       setName(data.name || "");
//     }
//   }, [supabase, user]);

//   const fetchAttendances = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("attendances")
//       .select("*")
//       .eq("user_id", user?.id)
//       .order("date", { ascending: false });

//     if (error) {
//       console.error("Error fetching profile", error);
//       return;
//     }

//     if (data) {
//       setAttendances(data);
//     }
//   }, [supabase, user]);

//   const handleUpdateProfile = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("profiles")
//       .update({ name })
//       .eq("id", user?.id);

//     if (data) {
//       setProfile({ ...profile!, name });
//       setEditMode(false);
//     } else if (error) {
//       alert("Error updating profile: " + error.message);
//     }
//   }, [supabase, user, name, profile]);

//   useEffect(() => {
//     fetchProfile();
//     fetchAttendances();
//   }, [fetchAttendances, fetchProfile]);

//   return (
//     <div className="space-y-6">
//       <h2 className="text-2xl font-semibold">Your Profile</h2>
//       {profile && (
//         <div className="bg-white shadow overflow-hidden sm:rounded-lg">
//           <div className="px-4 py-5 sm:px-6">
//             <h3 className="text-lg leading-6 font-medium text-gray-900">
//               User Information
//             </h3>
//           </div>
//           <div className="border-t border-gray-200">
//             <dl>
//               <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
//                 <dt className="text-sm font-medium text-gray-500">Email</dt>
//                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
//                   {profile.email}
//                 </dd>
//               </div>
//               <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
//                 <dt className="text-sm font-medium text-gray-500">Name</dt>
//                 <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
//                   {editMode ? (
//                     <input
//                       type="text"
//                       value={name}
//                       onChange={(e) => setName(e.target.value)}
//                       className="border rounded p-1"
//                     />
//                   ) : (
//                     profile.name || "Not set"
//                   )}
//                 </dd>
//               </div>
//             </dl>
//           </div>
//           <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
//             {editMode ? (
//               <button
//                 onClick={handleUpdateProfile}
//                 className="bg-blue-500 text-white rounded-md py-2 px-4 hover:bg-blue-600"
//               >
//                 Save
//               </button>
//             ) : (
//               <button
//                 onClick={() => setEditMode(true)}
//                 className="bg-green-500 text-white rounded-md py-2 px-4 hover:bg-green-600"
//               >
//                 Edit Profile
//               </button>
//             )}
//           </div>
//         </div>
//       )}
//       <div>
//         <h3 className="text-xl font-semibold mb-2">Your Attendance History</h3>
//         <table className="min-w-full divide-y divide-gray-200">
//           <thead className="bg-gray-50">
//             <tr>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Date
//               </th>
//               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                 Beers Consumed
//               </th>
//             </tr>
//           </thead>
//           <tbody className="bg-white divide-y divide-gray-200">
//             {attendances.map((attendance) => (
//               <tr key={attendance.id}>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                   {attendance.date}
//                 </td>
//                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                   {attendance.beer_count}
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };
