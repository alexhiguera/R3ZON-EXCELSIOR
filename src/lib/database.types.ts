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
                },"contract_annexes": {
                  Row: {
                    "body": string,"contract_id": string,"created_at": string,"id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"contract_id": string,"created_at"?: string,"id"?: string,"position"?: number,"title": string
                  }
                  Update: {
                    "body"?: string,"contract_id"?: string,"created_at"?: string,"id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_annexes_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_clause_selections": {
                  Row: {
                    "clause_version_id": string,"contract_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clause_version_id": string,"contract_id": string,"position"?: number
                  }
                  Update: {
                    "clause_version_id"?: string,"contract_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_clause_selections_clause_version_id_fkey"
      columns: ["clause_version_id"]
isOneToOne: false
      referencedRelation: "contract_clause_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_clause_selections_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_clause_versions": {
                  Row: {
                    "body": string,"clause_id": string,"created_at": string,"created_by": string | null,"id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"clause_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"version"?: number
                  }
                  Update: {
                    "body"?: string,"clause_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_clause_versions_clause_id_fkey"
      columns: ["clause_id"]
isOneToOne: false
      referencedRelation: "contract_clauses"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_clauses": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contract_signatures": {
                  Row: {
                    "contract_id": string,"id": string,"ip": string | null,"organization_id": string,"otp_verified_at": string,"signature_png": string,"signature_sha256": string,"signed_at": string,"signer_email": string,"signer_name": string,"signer_role": string,"signer_tax_id": string,"signer_user_id": string,"text_sha256": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contract_id": string,"id"?: string,"ip"?: string | null,"organization_id": string,"otp_verified_at": string,"signature_png": string,"signature_sha256": string,"signed_at"?: string,"signer_email": string,"signer_name": string,"signer_role": string,"signer_tax_id": string,"signer_user_id": string,"text_sha256": string,"user_agent"?: string | null
                  }
                  Update: {
                    "contract_id"?: string,"id"?: string,"ip"?: string | null,"organization_id"?: string,"otp_verified_at"?: string,"signature_png"?: string,"signature_sha256"?: string,"signed_at"?: string,"signer_email"?: string,"signer_name"?: string,"signer_role"?: string,"signer_tax_id"?: string,"signer_user_id"?: string,"text_sha256"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_signatures_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: true
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_signatures_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_template_versions": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"template_id": string,"version"?: number
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_template_versions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "contract_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_templates": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contracts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"delegated_email": string | null,"engagement_id": string,"id": string,"organization_id": string,"sent_at": string | null,"signed_at": string | null,"signed_text": string | null,"status": Database["public"]['Enums']["contract_status"],"template_version_id": string,"text_sha256": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"delegated_email"?: string | null,"engagement_id": string,"id"?: string,"organization_id": string,"sent_at"?: string | null,"signed_at"?: string | null,"signed_text"?: string | null,"status"?: Database["public"]['Enums']["contract_status"],"template_version_id": string,"text_sha256"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"delegated_email"?: string | null,"engagement_id"?: string,"id"?: string,"organization_id"?: string,"sent_at"?: string | null,"signed_at"?: string | null,"signed_text"?: string | null,"status"?: Database["public"]['Enums']["contract_status"],"template_version_id"?: string,"text_sha256"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_template_version_id_fkey"
      columns: ["template_version_id"]
isOneToOne: false
      referencedRelation: "contract_template_versions"
      referencedColumns: ["id"]
    }
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
                },"organization_billing": {
                  Row: {
                    "address": string,"billing_email": string | null,"city": string,"country": string,"created_at": string,"entity_type": string,"legal_name": string,"organization_id": string,"postal_code": string,"province": string | null,"tax_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"billing_email"?: string | null,"city": string,"country"?: string,"created_at"?: string,"entity_type": string,"legal_name": string,"organization_id": string,"postal_code": string,"province"?: string | null,"tax_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string,"billing_email"?: string | null,"city"?: string,"country"?: string,"created_at"?: string,"entity_type"?: string,"legal_name"?: string,"organization_id"?: string,"postal_code"?: string,"province"?: string | null,"tax_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_billing_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
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
                },"provider_profile": {
                  Row: {
                    "address": string,"email": string,"id": boolean,"legal_name": string,"tax_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"email"?: string,"id"?: boolean,"legal_name"?: string,"tax_id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"email"?: string,"id"?: boolean,"legal_name"?: string,"tax_id"?: string,"updated_at"?: string
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
"billing_complete":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"can_edit_billing":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"change_engagement_status":
{ Args: { "p_engagement_id": string,"p_reason"?: string,"p_status": Database["public"]['Enums']["engagement_status"] }; Returns: undefined
                           },
"confirm_engagement_data":
{ Args: { "p_engagement_id": string }; Returns: undefined
                           },
"contract_placeholder_names":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"contract_render":
{ Args: { "p_contract_id": string,"p_signer"?: Json }; Returns: string
                           },
"contract_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["contract_status"],"p_to": Database["public"]['Enums']["contract_status"] }; Returns: boolean
                           },
"contract_unknown_placeholders":
{ Args: { "p_body": string }; Returns: (string)[]
                           },
"contract_variables":
{ Args: { "p_contract_id": string,"p_signer"?: Json }; Returns: Json
                           },
"contract_visible_to_client":
{ Args: { "p_contract_id": string }; Returns: boolean
                           },
"create_client_with_invitation":
{ Args: { "p_conditions"?: string,"p_email": string,"p_name": string,"p_price_cents"?: number,"p_service_version_id"?: string }; Returns: {
              "organization_id": string,"token": string
            }[]
                           },
"create_invitation":
{ Args: { "p_email": string,"p_organization_id": string,"p_role"?: Database["public"]['Enums']["org_role"],"p_valid_for"?: string }; Returns: string
                           },
"delegate_contract_signature":
{ Args: { "p_contract_id": string,"p_email": string }; Returns: string
                           },
"engagement_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["engagement_status"],"p_to": Database["public"]['Enums']["engagement_status"] }; Returns: boolean
                           },
"format_eur":
{ Args: { "p_cents": number }; Returns: string
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
"log_client_view":
{ Args: { "p_organization_id": string }; Returns: undefined
                           },
"org_role_of":
{ Args: { "p_organization_id": string }; Returns: Database["public"]['Enums']["org_role"]
                           },
"organization_directory":
{ Args: { "p_organization_id": string }; Returns: {
              "display_name": string,"email": string,"joined_at": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
            }[]
                           },
"session_otp_verified_at":
{ Args: { "p_seconds"?: number }; Returns: string
                           },
"sign_contract":
{ Args: { "p_accepted": boolean,"p_contract_id": string,"p_signature_png_base64": string,"p_signer_name": string,"p_signer_role": string,"p_signer_tax_id": string }; Returns: string
                           },
"uuidv7":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"write_audit":
{ Args: { "p_action": string,"p_actor_id"?: string,"p_details": Json,"p_organization_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "contract_status": "borrador"|"enviado"|"firmado"|"anulado"|"sustituido","engagement_status": "borrador"|"invitada"|"datos_completos"|"firmada"|"pago_en_curso"|"pagada"|"activa"|"finalizada"|"cancelada"|"rescindida"|"en_impago","org_role": "owner"|"member"|"billing","payment_plan": "pago_unico"|"senal_entrega","platform_role": "client"|"staff"|"admin"
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
            "contract_status": ["borrador", "enviado", "firmado", "anulado", "sustituido"],"engagement_status": ["borrador", "invitada", "datos_completos", "firmada", "pago_en_curso", "pagada", "activa", "finalizada", "cancelada", "rescindida", "en_impago"],"org_role": ["owner", "member", "billing"],"payment_plan": ["pago_unico", "senal_entrega"],"platform_role": ["client", "staff", "admin"]
          }
        }
} as const
