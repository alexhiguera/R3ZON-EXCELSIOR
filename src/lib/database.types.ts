// GENERADO con `npm run db:types` desde el Supabase local. No se edita a mano.


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": string,"organization_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"organization_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"organization_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"engagement_status_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"engagement_id": string,"from_status": Database["public"]['Enums']["engagement_status"] | null,"id": string,"reason": string | null,"to_status": Database["public"]['Enums']["engagement_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"engagement_id": string,"from_status"?: Database["public"]['Enums']["engagement_status"] | null,"id"?: string,"reason"?: string | null,"to_status": Database["public"]['Enums']["engagement_status"]
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"engagement_id"?: string,"from_status"?: Database["public"]['Enums']["engagement_status"] | null,"id"?: string,"reason"?: string | null,"to_status"?: Database["public"]['Enums']["engagement_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagement_status_history_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    }
                  ]
                },"engagements": {
                  Row: {
                    "conditions": string | null,"created_at": string,"created_by": string | null,"id": string,"invitation_id": string | null,"organization_id": string,"price_cents": number,"service_version_id": string,"status": Database["public"]['Enums']["engagement_status"],"status_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conditions"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invitation_id"?: string | null,"organization_id": string,"price_cents": number,"service_version_id": string,"status"?: Database["public"]['Enums']["engagement_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "conditions"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"invitation_id"?: string | null,"organization_id"?: string,"price_cents"?: number,"service_version_id"?: string,"status"?: Database["public"]['Enums']["engagement_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagements_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_service_version_id_fkey"
      columns: ["service_version_id"]
isOneToOne: false
      referencedRelation: "service_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_service_version_id_fkey"
      columns: ["service_version_id"]
isOneToOne: false
      referencedRelation: "services_current"
      referencedColumns: ["version_id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string | null,"email": string,"expires_at": string,"id": string,"organization_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email": string,"expires_at": string,"id"?: string,"organization_id": string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "created_at": string,"organization_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"organization_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"platform_role": Database["public"]['Enums']["platform_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"platform_role"?: Database["public"]['Enums']["platform_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"platform_role"?: Database["public"]['Enums']["platform_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"service_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deposit_percent": number | null,"id": string,"includes": (string)[],"payment_plans": (Database["public"]['Enums']["payment_plan"])[],"price_cents": number,"service_id": string,"vat_rate": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deposit_percent"?: number | null,"id"?: string,"includes"?: (string)[],"payment_plans"?: (Database["public"]['Enums']["payment_plan"])[],"price_cents": number,"service_id": string,"vat_rate"?: number,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deposit_percent"?: number | null,"id"?: string,"includes"?: (string)[],"payment_plans"?: (Database["public"]['Enums']["payment_plan"])[],"price_cents"?: number,"service_id"?: string,"vat_rate"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_versions_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_versions_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services_current"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"summary": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "services_current": {
                  Row: {
                    "archived_at": string | null,"created_at": string | null,"deposit_percent": number | null,"id": string | null,"includes": (string)[] | null,"name": string | null,"payment_plans": (Database["public"]['Enums']["payment_plan"])[] | null,"price_cents": number | null,"summary": string | null,"vat_rate": number | null,"version": number | null,"version_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"audit_log_purge":
{ Args: { "p_before": string }; Returns: number
                           },
"change_engagement_status":
{ Args: { "p_engagement_id": string,"p_reason"?: string,"p_status": Database["public"]['Enums']["engagement_status"] }; Returns: undefined
                           },
"create_invitation":
{ Args: { "p_email": string,"p_organization_id": string,"p_role"?: Database["public"]['Enums']["org_role"],"p_valid_for"?: string }; Returns: string
                           },
"engagement_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["engagement_status"],"p_to": Database["public"]['Enums']["engagement_status"] }; Returns: boolean
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"invitations_purge":
{ Args: { "p_closed_before": string }; Returns: number
                           },
"invite_to_service":
{ Args: { "p_conditions"?: string,"p_email": string,"p_organization_id": string,"p_price_cents"?: number,"p_service_version_id": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_org_member":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"org_role_of":
{ Args: { "p_organization_id": string }; Returns: Database["public"]['Enums']["org_role"]
                           },
"organization_directory":
{ Args: { "p_organization_id": string }; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
            }[]
                           },
"uuidv7":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"write_audit":
{ Args: { "p_action": string,"p_actor_id"?: string,"p_details": Json,"p_organization_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "engagement_status": "borrador"|"invitada"|"datos_completos"|"firmada"|"pago_en_curso"|"pagada"|"activa"|"finalizada"|"cancelada"|"rescindida"|"en_impago","org_role": "owner"|"member"|"billing","payment_plan": "pago_unico"|"senal_entrega","platform_role": "client"|"staff"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "engagement_status": ["borrador", "invitada", "datos_completos", "firmada", "pago_en_curso", "pagada", "activa", "finalizada", "cancelada", "rescindida", "en_impago"],"org_role": ["owner", "member", "billing"],"payment_plan": ["pago_unico", "senal_entrega"],"platform_role": ["client", "staff", "admin"]
          }
        }
} as const
