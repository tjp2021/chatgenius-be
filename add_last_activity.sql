-- Add only the missing last_activity_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'channels' 
                  AND column_name = 'last_activity_at') 
    THEN 
        ALTER TABLE channels 
        ADD COLUMN last_activity_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$; 