-- Add tutorial completion fields to profiles table
ALTER TABLE profiles 
ADD COLUMN tutorial_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN tutorial_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for performance
CREATE INDEX idx_profiles_tutorial_completed ON profiles(tutorial_completed);

-- Add comment for documentation
COMMENT ON COLUMN profiles.tutorial_completed IS 'Whether the user has completed the initial tutorial';
COMMENT ON COLUMN profiles.tutorial_completed_at IS 'Timestamp when the tutorial was completed';
