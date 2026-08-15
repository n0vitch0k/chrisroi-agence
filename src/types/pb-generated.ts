/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Alertes: "alertes",
	Contrats: "contrats",
	DemandesRecrutement: "demandes_recrutement",
	Documents: "documents",
	Employes: "employes",
	Employeurs: "employeurs",
	ExperiencesPro: "experiences_pro",
	Parents: "parents",
	PersonnesUrgence: "personnes_urgence",
	Scans: "scans",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AlertesRecord = {
	contrat_id?: RecordIdString
	created: IsoAutoDateString
	employeur_id?: RecordIdString
	id: string
	lu?: boolean
	message?: string
	titre?: string
	type?: string
	updated: IsoAutoDateString
}

export const ContratsTypeContratOptions = {
	"heberge": "heberge",
	"externe": "externe",
	"temps_partiel": "temps_partiel",
} as const
export type ContratsTypeContratOptions = typeof ContratsTypeContratOptions[keyof typeof ContratsTypeContratOptions]
export type ContratsRecord = {
	commission_agence?: number
	commission_fixe?: number
	commission_payee?: boolean
	created: IsoAutoDateString
	date_contrat?: IsoDateString
	date_debut?: IsoDateString
	date_fin?: IsoDateString
	demande_id?: string
	domicile_employe?: string
	duree?: string
	employe_id?: RecordIdString
	employeur_id?: RecordIdString
	frais_dossier?: number
	frais_payes?: boolean
	frais_transport?: number
	id: string
	notes?: string
	numero_dossier?: string
	poste?: string
	salaire?: number
	signature_agence?: string
	signature_employe?: string
	signature_employeur?: string
	statut?: string
	type_contrat?: ContratsTypeContratOptions
	updated: IsoAutoDateString
}

export type DemandesRecrutementRecord = {
	categorie_emploi?: string
	created: IsoAutoDateString
	date_debut_souhaitee?: IsoDateString
	date_demande?: IsoDateString
	description?: string
	employeur_id?: RecordIdString
	id: string
	nombre_postes?: number
	notes?: string
	salaire_propose?: number
	statut?: string
	updated: IsoAutoDateString
}

export const DocumentsTypeOptions = {
	"carte_identite": "carte_identite",
	"carte_identite_parent": "carte_identite_parent",
	"extrait_naissance": "extrait_naissance",
	"permis_conduire": "permis_conduire",
	"passeport": "passeport",
	"cv": "cv",
} as const
export type DocumentsTypeOptions = typeof DocumentsTypeOptions[keyof typeof DocumentsTypeOptions]
export type DocumentsRecord = {
	employe_id: RecordIdString
	id: string
	image: FileNameString
	type: DocumentsTypeOptions
}

export const EmployesSituationMatrimonialeOptions = {
	"celibataire": "celibataire",
	"marie": "marie",
	"concubinage": "concubinage",
	"divorce": "divorce",
	"veuf": "veuf",
} as const
export type EmployesSituationMatrimonialeOptions = typeof EmployesSituationMatrimonialeOptions[keyof typeof EmployesSituationMatrimonialeOptions]
export type EmployesRecord = {
	a_deja_travaille?: boolean
	categorie_emploi?: string
	created: IsoAutoDateString
	date_inscription?: IsoDateString
	date_naissance?: string
	ethnie?: string
	experience_details?: string
	formations?: string
	id: string
	lieu_naissance?: string
	lieu_residence?: string
	motivation?: string
	nationalite?: string
	niveau_etude?: string
	nom: string
	photo?: FileNameString
	photo_uri?: string
	prenom: string
	religion?: string
	situation_matrimoniale?: EmployesSituationMatrimonialeOptions
	stages_effectues?: string
	statut?: string
	telephone?: string
	updated: IsoAutoDateString
}

export const EmployeursTypeBesoinOptions = {
	"particulier": "particulier",
	"entreprise": "entreprise",
	"commerce": "commerce",
} as const
export type EmployeursTypeBesoinOptions = typeof EmployeursTypeBesoinOptions[keyof typeof EmployeursTypeBesoinOptions]
export type EmployeursRecord = {
	adresse?: string
	created: IsoAutoDateString
	date_enregistrement?: IsoDateString
	email?: string
	fonction_contact?: string
	id: string
	nom_complet: string
	nom_contact?: string
	notes?: string
	prenom_contact?: string
	telephone?: string
	type_besoin?: EmployeursTypeBesoinOptions
	updated: IsoAutoDateString
}

export type ExperiencesProRecord = {
	contact?: string
	created: IsoAutoDateString
	employe_id: RecordIdString
	entreprise?: string
	id: string
	lieu?: string
	ordre?: number
	updated: IsoAutoDateString
}

export type ParentsRecord = {
	created: IsoAutoDateString
	domicile?: string
	employe_id: RecordIdString
	id: string
	nom?: string
	prenom?: string
	telephone?: string
	type?: string
	updated: IsoAutoDateString
}

export type PersonnesUrgenceRecord = {
	created: IsoAutoDateString
	employe_id: RecordIdString
	id: string
	nom?: string
	ordre?: number
	prenom?: string
	telephone?: string
	updated: IsoAutoDateString
}

export type ScansRecord = {
	id: string
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AlertesResponse<Texpand = unknown> = Required<AlertesRecord> & BaseSystemFields<Texpand>
export type ContratsResponse<Texpand = unknown> = Required<ContratsRecord> & BaseSystemFields<Texpand>
export type DemandesRecrutementResponse<Texpand = unknown> = Required<DemandesRecrutementRecord> & BaseSystemFields<Texpand>
export type DocumentsResponse<Texpand = unknown> = Required<DocumentsRecord> & BaseSystemFields<Texpand>
export type EmployesResponse<Texpand = unknown> = Required<EmployesRecord> & BaseSystemFields<Texpand>
export type EmployeursResponse<Texpand = unknown> = Required<EmployeursRecord> & BaseSystemFields<Texpand>
export type ExperiencesProResponse<Texpand = unknown> = Required<ExperiencesProRecord> & BaseSystemFields<Texpand>
export type ParentsResponse<Texpand = unknown> = Required<ParentsRecord> & BaseSystemFields<Texpand>
export type PersonnesUrgenceResponse<Texpand = unknown> = Required<PersonnesUrgenceRecord> & BaseSystemFields<Texpand>
export type ScansResponse<Texpand = unknown> = Required<ScansRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	alertes: AlertesRecord
	contrats: ContratsRecord
	demandes_recrutement: DemandesRecrutementRecord
	documents: DocumentsRecord
	employes: EmployesRecord
	employeurs: EmployeursRecord
	experiences_pro: ExperiencesProRecord
	parents: ParentsRecord
	personnes_urgence: PersonnesUrgenceRecord
	scans: ScansRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	alertes: AlertesResponse
	contrats: ContratsResponse
	demandes_recrutement: DemandesRecrutementResponse
	documents: DocumentsResponse
	employes: EmployesResponse
	employeurs: EmployeursResponse
	experiences_pro: ExperiencesProResponse
	parents: ParentsResponse
	personnes_urgence: PersonnesUrgenceResponse
	scans: ScansResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
