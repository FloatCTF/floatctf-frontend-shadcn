/** adminPlatform domain copy (English). */

export default {
	common: {
		searchPlaceholder: "Search",
		protectedSkip: "{{count}} selected setting(s) are protected and will be skipped.",
		deleteSelected: "Delete selected",
		deleteSelectedCount: " ({{count}})",
		countItems: "{{count}} items",
		outOfRangeTitle: "No data on this page",
		outOfRangeDescription: "Entries may have just been deleted; reset the pagination.",
		resetPage: "Back to page 1",
		refresh: "Refresh",
		rowActions: "Actions: {{name}}",
		listSeparator: ", ",
		reasonSeparator: "; ",
		emptyJson: "(empty)",
		noDescription: "(no description)",
		all: "All",
		protected: "Protected",
		deletable: "Deletable",
		enabled: "Enabled",
		disabled: "Disabled",
	},
	roles: {
		documentTitle: "Roles & permissions · FloatCTF Console",
		title: "Roles & permissions",
		description:
			"Platform RBAC: a role is a permission set, and accounts gain management capabilities by holding roles.",
		errorTitle: "Failed to load roles",
		create: "New role",
		section: {
			title: "Roles",
			description:
				"Built-in roles cannot be deleted and their permission sets are fixed. The holder count is shown before deleting a custom role.",
		},
		search: {
			placeholder: "Search role name / key",
			ariaLabel: "Search roles",
		},
		empty: {
			title: "No roles",
			description:
				"Built-in roles are seeded on platform startup. If this stays empty, check backend initialization.",
		},
		filteredEmpty: {
			title: "No matching roles",
			description: "Try a different search keyword or role key.",
		},
		columns: {
			id: "ID",
			key: "Key",
			name: "Name",
			description: "Description",
			protected: "Built-in",
			role: "Role",
			flags: "Attributes",
			permissions: "Permissions",
			holders: "Accounts",
		},
		flags: {
			builtin: "Built-in",
			custom: "Custom",
			grantsAll: "All powers",
		},
		permissionsAll: "All permissions (short-circuit)",
		menu: {
			edit: "Edit",
			delete: "Delete",
			protectedDeleteHint: "Built-in roles cannot be deleted (backend returns 409)",
		},
		confirm: {
			title: "Delete role",
			description:
				"Role “{{name}}” will be deleted; {{count}} accounts currently hold it.",
			consequence1:
				"Accounts holding this role immediately lose its permissions (backend re-evaluates every request).",
			consequence2: "Deletion is irreversible; the accounts themselves are not deleted.",
			confirmText: "Delete",
		},
		form: {
			editTitle: "Edit role: {{name}}",
			createTitle: "New role",
			protectedDescription:
				"This built-in role's permission set is defined by the platform; only name and description can change here.",
			replaceDescription:
				"Permissions are replaced as a whole: after saving, the role holds exactly the checked set.",
			cancel: "Cancel",
			save: "Save changes",
			create: "Create role",
			keyLabel: "Role key",
			keyPlaceholder: "e.g. ops-lead",
			keyHint: "Stable identifier; it cannot be changed after creation.",
			nameLabel: "Name",
			descriptionLabel: "Description",
			permissionsLabel: "Permission set",
			permissionsLocked: " (read-only)",
			selectedCount: "{{count}} selected",
			loadFailed: "Failed to load permission catalog: {{message}}",
			loading: "Loading permission catalog…",
			highRisk: "High risk",
		},
		toasts: {
			created: "Role created",
			createFailed: "Failed to create role",
			updated: "Role updated",
			updateFailed: "Failed to update role",
			deleted: "Role deleted",
			deleteFailed: "Failed to delete role",
		},
		requests: {
			create: "create role",
			update: "update role",
			delete: "delete role",
		},
	},
	logs: {
		levels: {
			info: "Info",
			warn: "Warning",
			error: "Error",
			debug: "Debug",
		},
		documentTitle: "Operation logs · FloatCTF Console",
		title: "Operation logs",
		description:
			"Platform audit log (read-only). Level is matched exactly; other fields follow the backend contains / exact mappings.",
		section: {
			title: "Log entries",
			description: "Newest first; click a row to view the full message and details (JSON).",
		},
		search: {
			fieldAria: "Search field",
			levelAria: "Log level",
			allLevels: "All levels",
			placeholder: "Search {{field}} ({{hint}})",
			fields: {
				action: "action",
				category: "category",
				ip: "IP",
				actor: "actor ID",
				level: "level",
				fallback: "logs",
			},
			hints: {
				contains: "contains match",
				exact: "exact match",
				exactUuid: "exact match (UUID)",
			},
		},
		columns: {
			time: "Created",
			id: "ID",
			actor: "Actor ID",
			details: "Details",

			level: "Level",
			category: "Category",
			action: "Action",
			message: "Message",
			ip: "IP",
		},
		errorTitle: "Failed to load logs",
		empty: {
			title: "No logs",
			description: "Audit records will appear here once the platform produces them.",
			filteredTitle: "No matching logs",
			filteredDescription:
				"Try a different level or search condition (levels are matched exactly).",
		},
		detail: {
			title: "Log details",
			idLabel: "Log ID",
			time: "Time",
			level: "Level",
			category: "Category",
			action: "Action",
			ip: "Source IP",
			actor: "Actor ID",
			message: "Message",
			details: "Details (JSON)",
		},
	},
	settings: {
		documentTitle: "Dynamic settings · FloatCTF Console",
		title: "Dynamic settings",
		description:
			"Platform runtime configuration. Protected keys can only be edited, never deleted by the backend.",
		errorTitle: "Failed to load settings",
		section: {
			title: "Settings",
			description:
				"{{total}} entries ({{protectedCount}} protected). The settings API accepts no pagination / filter parameters, so search and paging happen on this page.",
		},
		searchPlaceholder: "Search key / value / description",
		protectedSkip: "{{count}} selected setting(s) are protected and will be skipped.",
		deleteSelected: "Delete selected settings",
		empty: {
			title: "No settings",
			description:
				"Default settings are seeded on platform startup. If this stays empty, check backend initialization.",
		},
		filtered: {
			title: "No matching settings",
			description: "Try a different search keyword.",
		},
		columns: {
			id: "ID",
			key: "Key",
			value: "Value",
			resolved: "Resolved value",
			type: "Type",
			protected: "Protected",
			description: "Description",
			updatedAt: "Updated",
		},
		activeFrontend: "Active frontend",
		types: {
			string: "String",
			integer: "Integer",
			boolean: "Boolean",
			float: "Float",
		},
		typeOption: "{{label}} ({{type}})",
		menu: {
			edit: "Edit",
			overrideEdit: "Edit value (extra confirmation)",
			goFrontends: "Open frontend selector",
			delete: "Delete",
			protectedDelete: "Protected, cannot delete",
			ariaLabel: "Settings actions: {{key}}",
		},
		confirm: {
			blockedTitle: "Protected settings cannot be deleted",
			blockedDescription:
				"Skipped: {{keys}} (the backend rejects deleting protected settings)",
			titleOne: "Delete setting {{key}}?",
			titleMany: "Delete {{count}} settings?",
			consequence1:
				"Platform features reading this key immediately fall back to built-in defaults or fail",
			consequence2:
				"If other settings reference this key ($KEY), their resolved values change as well",
			consequence3:
				"Deletion is irreversible (the key must be recreated with the correct value)",
			confirmText: "Delete permanently",
		},
		override: {
			title: "Override protected setting {{key}}?",
			descKey: "Key changes from {{from}} to {{to}}",
			descValue: "Value changes from “{{from}}” to “{{to}}”",
			descMeta: "Only metadata such as description / type changes",
			consequence1:
				"Platform features depend on protected settings; a wrong value can break or disable them",
			consequence2:
				"Changes invalidate caches immediately and apply to all requests; there is no automatic rollback",
			consequenceFrontend:
				"FRONTEND_ACTIVE decides the interface all users load next, and its value must be an installed safe frontend ID",
			consequence3:
				"The backend does not add extra protection when editing a protected key; verify the value",
			confirmText: "Override",
		},
		deleteSuccess: "Deleted {{count}} settings",
		deleteFailed: "Failed to delete settings",
		field: {
			keyLabel: "Key",
			keyPlaceholder: "e.g. FRONTEND_ACTIVE",
			typeLabel: "Type",
			typeHint: "The platform parses the value according to this type.",
			valueLabel: "Value",
			valueRequired: "Value is required",
			keyRequired: "Key is required",
			valueHintFrontend:
				"FRONTEND_ACTIVE must be a safe frontend ID: [a-z0-9][a-z0-9._-]*, up to 64 characters; prefer the frontend selector.",
			valueHint:
				"Supports $OTHER_KEY references (the backend resolves them into resolved_value when reading).",
			descriptionLabel: "Description",
			protectedLabel: "Protected",
			protectedHint:
				"Protected keys cannot be deleted; turning protection off makes deletion possible, so be careful.",
			resolvedLabel: "Current resolved value:",
			resolvedCopyLabel: "Resolved value",
			revealSecret: "Reveal value",
			hideSecret: "Hide value",
			secretHint: "Sensitive setting: the value is hidden by default; click the eye to reveal it. Saving submits it as plain text to the backend.",
			requiredHint: "Key and value are required",
		},
		form: {
			editTitle: "Edit setting {{key}}",
			createTitle: "New setting",
			protectedDescription:
				"This is a protected setting: saving requires a confirmation phrase, and the backend forbids deletion.",
			normalDescription:
				"Keys are unique; the value is a string that the platform parses according to its type.",
			save: "Save",
			create: "Create",
			cancel: "Cancel",
			idHint: "ID",
		},
		warning: {
			protectedNote:
				"Protected key (protected=true): editable, not deletable. Saving requires an extra confirmation with the phrase below.",
		},
		toasts: {
			created: "Setting created",
			createFailed: "Failed to create setting",
			updated: "Setting updated",
			updateFailed: "Failed to update setting",
		},
		requests: {
			create: "create setting",
			update: "update setting",
			delete: "delete setting",
		},
	},
	frontends: {
		documentTitle: "Frontend selector · FloatCTF Console",
		title: "Frontends",
		description:
			"Choose the pluggable frontend active on the platform. A frontend is a complete browser application (its own routes / layout / interactions), not a color theme.",
		badge: "specialized",
		actions: {
			reload: "Reload registry",
			settingsPage: "Settings",
		},
		stats: {
			installed: "Installed frontends",
			waitingRegistry: "Waiting for registry",
			updatedAt: "Registry updated",
			runtimeContract: "Platform runtime contract",
			apiContract: "API contract",
			compileTimeConstant: "compile-time constant",
			active: "Active",
			activeMissing: "FRONTEND_ACTIVE is missing from platform settings",
			activeUpdatedAt: "updated",
		},
		selector: {
			label: "Active frontend ({{key}})",
			meta: "Version {{version}} · entry {{entry}}",
			breakGlass: "Break-glass: add ?frontend=default to any page to load the built-in frontend.",
		},
		registry: {
			title: "Registry (local static file)",
			description:
				"Lists only frontends installed on the host; install / upgrade / rollback are done by operators with frontend.sh.",
			address: "Registry URL",
			schemaVersion: "schemaVersion",
			updatedAt: "updatedAt",
			loading: "Reading registry…",
			errorTitle: "Failed to read local frontend registry",
			emptyTitle: "No frontends in the registry",
			emptyDescription:
				"The host has no frontend artifacts installed; install default to select one here.",
			errorDetailsTitle: "Registry error details",
			errorDetailsDescription:
				"Fail-closed: read / validation failures never degrade into an “empty registry”; every error is listed for diagnosis.",
		},
		errors: {
			http: "Failed to read local frontend registry: HTTP {{status}} {{statusText}}",
			address: "URL: {{url}}",
			http404:
				"The file does not exist: the host may have no frontend artifacts installed, or the static prefix is not mounted.",
			httpOther: "The same-origin static file is unreadable; check the reverse proxy / mount.",
			invalid:
				"Local frontend registry validation failed: registry.json does not match the registry schema",
			fetch: "Cannot read local frontend registry: {{message}}",
			sameOrigin:
				"Make sure this page is served from the same origin as the platform and the static file is reachable.",
			noActive: "FRONTEND_ACTIVE is missing from platform settings; cannot switch",
		},
		compat: {
			runtimeMismatch:
				"requires frontend runtime contract {{required}}, platform provides {{actual}}",
			apiMismatch: "requires API contract {{required}}, platform provides {{actual}}",
			versionMissingInVersions: "current version {{version}} is not present in versions",
			compatible: "Compatible",
			incompatible: "Incompatible",
			contractCompatible: "Contract compatible",
			contractIncompatible: "Contract incompatible",
			versionMissing: "Version missing",
		},
		columns: {
			id: "Frontend ID",
			name: "Name",
			version: "Current version",
			compat: "Contract",
			runtime: "runtime / api",
			entry: "Entry",
			installedAt: "Installed",
		},
		pills: {
			builtin: "Platform built-in",
			active: "Active",
			currentVersion: "Current version",
			thirdParty: "Third-party install",
			builtinNoRemove: "Platform built-in (cannot remove)",
		},
		switch: {
			title: "Switch active frontend",
			description:
				"Writes the platform setting FRONTEND_ACTIVE (a protected key: editable, not deletable); it takes effect after a page refresh.",
			currentLabel: "Active frontend",
			noActiveDescription:
				"The key is missing from platform settings. The backend normally seeds it to default on startup; otherwise switching is unavailable here.",
			goSettings: "Open dynamic settings to create the key",
			selectAria: "Choose active frontend",
			placeholder: "Select an installed frontend",
			option: "{{id}} · {{name}} · v{{version}}",
			optionNameFallback: "?",
			optionBuiltinSuffix: " (platform built-in)",
			optionDisabledSuffix: " (contract incompatible, disabled)",
			selectedTitle: "Selection details",
			versionLabel: "Version {{version}}",
			entryLabel: "Entry",
			selectHint: "Select a frontend to inspect contract compatibility and its entry.",
			loadingSettings: "Reading platform settings…",
			settingsLoadFailed: "Failed to read platform settings",
			save: "Save and switch",
			saving: "Saving…",
			reload: "Refresh page",
			savedHint: "Saved as “{{id}}”; refresh the page to hand over to that frontend.",
			breakGlass:
				"Break-glass recovery: append the following parameter to any page URL to open with the built-in frontend (this load only; the setting is unchanged).",
			confirmTitle: "Switch the active frontend to “{{id}}”?",
			confirmDescription:
				"Only the platform setting FRONTEND_ACTIVE changes; open pages must be refreshed to load the new frontend.",
			consequence1: "All users will load “{{id}}” on their next page load",
			consequence2:
				"Frontends differ completely in routes / layout / interactions; users will see a different interface",
			consequence3:
				"This frontend's admin pages can only be restored via ?frontend=default or by reverting this setting",
			confirmText: "Save and switch",
			toastSwitched: "Switched to frontend “{{id}}”",
			toastSwitchedDescription: "Refresh the page to hand over to the new frontend.",
			toastSwitchFailed: "Failed to switch frontend",
			toastIncompatible: "This frontend is incompatible with the current platform contract",
		},
		detail: {
			title: "Version details",
			namedTitle: "Installed versions of {{id}}",
			description:
				"Every version must explicitly declare its compatibility with the platform contracts; the current version is selected by the registry currentVersion pointer.",
			id: "Frontend ID",
			currentVersion: "currentVersion",
			protected: "protected",
			versionCount: "Installed versions",
			entry: "Entry",
			styles: "Styles",
			installedAt: "Installed",
			author: "Author {{author}}",
			runtimeApi: "runtime {{runtime}} · api {{api}}",
			emptyStyles: "(none)",
		},
	},
	tasks: {
		documentTitle: "Scheduled tasks · FloatCTF Console",
		title: "Scheduled tasks",
		description:
			"Platform cron / one-off / startup tasks. Manual runs only enqueue the task; results are not awaited synchronously.",
		create: "New task",
		section: {
			title: "Tasks",
			description:
				"Search and group conditions are sent to the backend together (filter syntax: `kind:x & task_key:y`).",
		},
		filters: {
			groupAria: "Task group",
			kinds: {
				all: "All groups",
				service: "service · admin-created",
				system: "system · platform built-in",
				event: "event · event runtime",
			},
			fieldAria: "Search field",
			searchPlaceholder: "Search {{field}}",
			fields: {
				task_name: "task name",
				task_key: "task key",
				status: "status",
			},
		},
		columns: {
			id: "ID",
			cron: "Cron expression",
			executeAt: "Execute at",
			protected: "Protected",
			name: "Task name",
			key: "Task key",
			trigger: "Trigger",
			status: "Status",
			schedule: "Schedule",
			enabled: "Enabled",
			lastRun: "Last run",
			updatedAt: "Updated",
		},
		pills: {
			protected: "Protected",
		},
		status: {
			pending: "Pending",
			running: "Running",
			completed: "Completed",
			failed: "Failed",
		},
		trigger: {
			once: "One-off",
			cron: "Cron",
			startup: "Platform startup",
		},
		menu: {
			run: "Run now",
			edit: "Edit",
			detail: "Run details",
			delete: "Delete",
			protectedDelete: "Protected, cannot delete",
			ariaLabel: "Task actions: {{name}}",
		},
		errors: {
			load: "Failed to load scheduled tasks",
		},
		empty: {
			title: "No scheduled tasks",
			description:
				"Platform built-in tasks are seeded by the backend; admins can also create one-off / Cron tasks.",
			filteredTitle: "No matching tasks",
			filteredDescription: "Try another group or adjust the search conditions.",
		},
		deleteSelected: "Delete selected tasks",
		run: {
			title: "Run “{{name}}” now?",
			description: "Task key {{key}} · trigger {{trigger}}",
			consequence1:
				"The scheduler immediately picks up the task (status set to pending, execute_at set to now)",
			consequence2:
				"The task really modifies platform data / calls the host helper, with the same side effects as a scheduled run",
			consequence3:
				"Repeated clicks enqueue the task repeatedly; make sure it is not already running",
			confirmText: "Enqueue run",
			toastTitle: "Task “{{name}}” enqueued",
			toastDescription:
				"Status {{status}}; the scheduler picks it up within milliseconds. Refresh later to see the result.",
			toastFailed: "Failed to run task",
		},
		remove: {
			blockedTitle: "Protected tasks cannot be deleted",
			blockedDescription:
				"Skipped: {{names}} (the backend rejects deleting protected tasks)",
			titleOne: "Delete task “{{name}}”?",
			titleMany: "Delete {{count}} scheduled tasks?",
			consequence1:
				"The task is no longer scheduled: pending execute_at / cron triggers stop firing",
			consequence2:
				"If other features reference the task, their automation silently stops",
			consequence3:
				"Deletion is irreversible (recreate it and restore the task key and trigger parameters)",
			confirmText: "Delete permanently",
			toastSuccess: "Deleted {{count}} scheduled tasks",
			toastFailed: "Failed to delete scheduled tasks",
		},
		detail: {
			title: "Run details",
			idLabel: "Task ID",
			taskKey: "Task key",
			status: "Status",
			trigger: "Trigger",
			cron: "Cron",
			executeAt: "Execute at",
			expiresAt: "Expires at",
			groupId: "Group ID",
			groupHint: "Non-empty means an event runtime task",
			attempts: "Attempts",
			timeout: "Timeout",
			timeoutHint: "Runtime field; create / edit APIs do not accept it",
			lastRun: "Last run",
			lockedAt: "Locked at",
			heartbeat: "Heartbeat",
			description: "Description",
			lastError: "Last error",
			payload: "payload (JSON, read-only)",
		},
		form: {
			editTitle: "Edit task {{name}}",
			createTitle: "New scheduled task",
			description:
				"The task key must be registered by the platform (backend validation); unknown keys are rejected with a specific error.",
			save: "Save",
			create: "Create",
			cancel: "Cancel",
			idHint: "ID",
			createHint: "Task name, key and trigger parameters are validated by the backend",
			taskName: "Task name",
			taskKey: "Task key",
			taskKeyHint:
				"A platform-registered TaskKey, e.g. awd.round.end; unknown keys return 400 from the backend.",
			triggerType: "Trigger type",
			cron: "Cron expression",
			cronPlaceholder: "0 */5 * * * * *",
			cronHint: "Required when trigger_type=cron (validated by the backend cron library).",
			executeAt: "Execute at",
			executeAtHint: "Required when trigger_type=once; leave empty to keep the current value.",
			expiresAt: "Expires at",
			expiresAtHint: "Leave empty for no expiry.",
			descriptionField: "Description",
			enabled: "Enabled",
			enabledHint: "Disabled tasks are not picked up by the scheduler.",
			protected: "Protected",
			protectedHint:
				"Protected tasks cannot be deleted (backend rejects it); enable with care.",
			runtimeNote:
				"Note: max_attempts / timeout_secs are runtime fields not accepted by create or edit; payload is written by the platform per task key. Both are read-only in run details.",
		},
		validation: {
			taskNameRequired: "Task name is required",
			taskKeyRequired: "Task key is required",
			executeAtRequired: "trigger_type=once requires an execute time (the backend rejects it too)",
			cronShape: "Cron needs 7 fields: second minute hour day month weekday year (e.g. 0 */5 * * * * *).",
			cronRequired: "trigger_type=cron requires a Cron expression (the backend rejects it too)",
		},
		toasts: {
			created: "Scheduled task created",
			createFailed: "Failed to create scheduled task",
			updated: "Scheduled task updated",
			updateFailed: "Failed to update scheduled task",
		},
		requests: {
			create: "create scheduled task",
			update: "update scheduled task",
			run: "run scheduled task",
			delete: "delete scheduled tasks",
		},
	},
};
