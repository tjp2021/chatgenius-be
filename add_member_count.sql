-- Add only the missing member_count column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'channels' 
                  AND column_name = 'member_count') 
    THEN 
        ALTER TABLE channels 
        ADD COLUMN member_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$; 