import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      configService.get('SUPABASE_URL'),
      configService.get('SUPABASE_ANON_KEY'),
    );
  }

  getClient() {
    return this.supabase;
  }
} 