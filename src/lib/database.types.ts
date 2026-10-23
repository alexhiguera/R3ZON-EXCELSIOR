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
      referencedRelation: "engagement_collections"
      referencedColumns: ["engagement_id"]
    },{
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
      referencedRelation: "engagement_collections"
      referencedColumns: ["engagement_id"]
    },{
      foreignKeyName: "engagement_status_history_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    }
                  ]
                },"engagements": {
                  Row: {
                    "conditions": string | null,"created_at": string,"created_by": string | null,"delivered_at": string | null,"id": string,"invitation_id": string | null,"organization_id": string,"payment_plan": Database["public"]['Enums']["payment_plan"],"payment_review": boolean,"payment_review_note": string | null,"price_cents": number,"requires_payment": boolean,"requires_signature": boolean,"service_version_id": string,"status": Database["public"]['Enums']["engagement_status"],"status_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conditions"?: string | null,"created_at"?: string,"created_by"?: string | null,"delivered_at"?: string | null,"id"?: string,"invitation_id"?: string | null,"organization_id": string,"payment_plan": Database["public"]['Enums']["payment_plan"],"payment_review"?: boolean,"payment_review_note"?: string | null,"price_cents": number,"requires_payment"?: boolean,"requires_signature"?: boolean,"service_version_id": string,"status"?: Database["public"]['Enums']["engagement_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "conditions"?: string | null,"created_at"?: string,"created_by"?: string | null,"delivered_at"?: string | null,"id"?: string,"invitation_id"?: string | null,"organization_id"?: string,"payment_plan"?: Database["public"]['Enums']["payment_plan"],"payment_review"?: boolean,"payment_review_note"?: string | null,"price_cents"?: number,"requires_payment"?: boolean,"requires_signature"?: boolean,"service_version_id"?: string,"status"?: Database["public"]['Enums']["engagement_status"],"status_changed_at"?: string,"updated_at"?: string
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
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"currency": string,"engagement_id": string,"id": string,"invoice_reference": string | null,"invoiced_at": string | null,"method": Database["public"]['Enums']["payment_method"],"organization_id": string,"paid_on": string,"provider_reference": string | null,"receipt_reference": string | null,"reference": string | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"voided_at": string | null,"voided_by": string | null,"voided_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"engagement_id": string,"id"?: string,"invoice_reference"?: string | null,"invoiced_at"?: string | null,"method": Database["public"]['Enums']["payment_method"],"organization_id": string,"paid_on": string,"provider_reference"?: string | null,"receipt_reference"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"voided_at"?: string | null,"voided_by"?: string | null,"voided_reason"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"engagement_id"?: string,"id"?: string,"invoice_reference"?: string | null,"invoiced_at"?: string | null,"method"?: Database["public"]['Enums']["payment_method"],"organization_id"?: string,"paid_on"?: string,"provider_reference"?: string | null,"receipt_reference"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"voided_at"?: string | null,"voided_by"?: string | null,"voided_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagement_collections"
      referencedColumns: ["engagement_id"]
    },{
      foreignKeyName: "payments_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
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
                },"project_briefing_items": {
                  Row: {
                    "answered_at": string | null,"created_at": string,"help": string | null,"id": string,"kind": Database["public"]['Enums']["briefing_kind"],"label": string,"organization_id": string,"position": number,"project_id": string,"required": boolean,"section": string,"staff_note": string | null,"status": Database["public"]['Enums']["briefing_status"],"updated_at": string,"updated_by": string | null,"value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"created_at"?: string,"help"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["briefing_kind"],"label": string,"organization_id": string,"position": number,"project_id": string,"required": boolean,"section": string,"staff_note"?: string | null,"status"?: Database["public"]['Enums']["briefing_status"],"updated_at"?: string,"updated_by"?: string | null,"value"?: string | null
                  }
                  Update: {
                    "answered_at"?: string | null,"created_at"?: string,"help"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["briefing_kind"],"label"?: string,"organization_id"?: string,"position"?: number,"project_id"?: string,"required"?: boolean,"section"?: string,"staff_note"?: string | null,"status"?: Database["public"]['Enums']["briefing_status"],"updated_at"?: string,"updated_by"?: string | null,"value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_briefing_items_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_briefing_items_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_briefing_progress"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "project_briefing_items_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"engagement_id": string,"id": string,"name": string,"organization_id": string,"status": Database["public"]['Enums']["project_status"],"status_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"engagement_id": string,"id"?: string,"name": string,"organization_id": string,"status"?: Database["public"]['Enums']["project_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"engagement_id"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"status"?: Database["public"]['Enums']["project_status"],"status_changed_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "engagement_collections"
      referencedColumns: ["engagement_id"]
    },{
      foreignKeyName: "projects_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
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
                },"service_briefing_items": {
                  Row: {
                    "created_at": string,"help": string | null,"id": string,"kind": Database["public"]['Enums']["briefing_kind"],"label": string,"position": number,"required": boolean,"section": string,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"help"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["briefing_kind"],"label": string,"position": number,"required"?: boolean,"section"?: string,"service_id": string
                  }
                  Update: {
                    "created_at"?: string,"help"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["briefing_kind"],"label"?: string,"position"?: number,"required"?: boolean,"section"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_briefing_items_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_briefing_items_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services_current"
      referencedColumns: ["id"]
    }
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
            "engagement_collections": {
                  Row: {
                    "balance_cents": number | null,"delivered_at": string | null,"deposit_cents": number | null,"due_now_cents": number | null,"engagement_id": string | null,"organization_id": string | null,"paid_cents": number | null,"payment_plan": Database["public"]['Enums']["payment_plan"] | null,"payment_review": boolean | null,"pending_cents": number | null,"requires_payment": boolean | null,"status": Database["public"]['Enums']["collection_status"] | null,"total_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "engagements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"project_briefing_progress": {
                  Row: {
                    "changes_requested": number | null,"done": number | null,"organization_id": string | null,"project_id": string | null,"required_done": number | null,"required_total": number | null,"to_review": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "projects_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"services_current": {
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
"amount_due_now":
{ Args: { "p_engagement_id": string }; Returns: number
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
{ Args: { "p_conditions"?: string,"p_email": string,"p_name": string,"p_payment_plan"?: Database["public"]['Enums']["payment_plan"],"p_price_cents"?: number,"p_requires_payment"?: boolean,"p_requires_signature"?: boolean,"p_service_version_id"?: string }; Returns: {
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
"invite_engagement":
{ Args: { "p_email": string,"p_engagement_id": string }; Returns: string
                           },
"invite_to_service":
{ Args: { "p_conditions"?: string,"p_email": string,"p_organization_id": string,"p_payment_plan"?: Database["public"]['Enums']["payment_plan"],"p_price_cents"?: number,"p_requires_payment"?: boolean,"p_requires_signature"?: boolean,"p_service_version_id": string }; Returns: string
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
"project_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["project_status"],"p_to": Database["public"]['Enums']["project_status"] }; Returns: boolean
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
            "briefing_kind": "texto"|"color"|"tipografia"|"enlace","briefing_status": "pendiente"|"mas_tarde"|"no_aplica"|"aportado"|"cambios"|"validado","collection_status": "no_pagado"|"parcialmente_pagado"|"pagado"|"pendiente_revision","contract_status": "borrador"|"enviado"|"firmado"|"anulado"|"sustituido","engagement_status": "borrador"|"invitada"|"datos_completos"|"firmada"|"activa"|"finalizada"|"cancelada"|"rescindida","org_role": "owner"|"member"|"billing","payment_method": "transferencia"|"otro"|"stripe","payment_plan": "pago_unico"|"senal_entrega","payment_status": "pendiente"|"confirmado"|"fallido"|"devuelto"|"anulado","platform_role": "client"|"staff"|"admin","project_status": "briefing"|"diseno"|"desarrollo"|"revision"|"lanzado"|"mantenimiento"|"en_pausa"|"cancelado"
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
            "briefing_kind": ["texto", "color", "tipografia", "enlace"],"briefing_status": ["pendiente", "mas_tarde", "no_aplica", "aportado", "cambios", "validado"],"collection_status": ["no_pagado", "parcialmente_pagado", "pagado", "pendiente_revision"],"contract_status": ["borrador", "enviado", "firmado", "anulado", "sustituido"],"engagement_status": ["borrador", "invitada", "datos_completos", "firmada", "activa", "finalizada", "cancelada", "rescindida"],"org_role": ["owner", "member", "billing"],"payment_method": ["transferencia", "otro", "stripe"],"payment_plan": ["pago_unico", "senal_entrega"],"payment_status": ["pendiente", "confirmado", "fallido", "devuelto", "anulado"],"platform_role": ["client", "staff", "admin"],"project_status": ["briefing", "diseno", "desarrollo", "revision", "lanzado", "mantenimiento", "en_pausa", "cancelado"]
          }
        }
} as const
