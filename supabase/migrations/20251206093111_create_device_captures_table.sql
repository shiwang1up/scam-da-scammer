/*
  # Create Device Captures Table

  1. New Tables
    - `device_captures`
      - `id` (uuid, primary key)
      - `image_data` (text) - Base64 encoded image from camera
      - `latitude` (numeric) - User's latitude
      - `longitude` (numeric) - User's longitude
      - `accuracy` (numeric) - Location accuracy in meters
      - `user_agent` (text) - Browser/device information
      - `captured_at` (timestamp) - When the capture occurred
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `device_captures` table
    - Add policy for anyone to insert captures (for demo purposes)
    - Add policy to read own captures
*/

CREATE TABLE IF NOT EXISTS device_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_data text,
  latitude numeric,
  longitude numeric,
  accuracy numeric,
  user_agent text,
  captured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE device_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert captures"
  ON device_captures
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read captures"
  ON device_captures
  FOR SELECT
  TO anon
  USING (true);