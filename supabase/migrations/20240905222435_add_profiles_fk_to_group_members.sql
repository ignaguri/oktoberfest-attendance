ALTER TABLE group_members
ADD CONSTRAINT fk_user_id
FOREIGN KEY (user_id) REFERENCES profiles(id);
