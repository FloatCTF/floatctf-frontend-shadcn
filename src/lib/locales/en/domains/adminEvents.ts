/** adminEvents domain copy (English). */

export default {
	actions: {
		deleteEvent: "delete the event",
		loadEvent: "load the event",
		createEvent: "create the event",
		saveEvent: "save the event",
		publishChallenges: "publish challenges",
		hideChallenges: "hide challenges",
		removeChallenges: "remove challenges",
		setChallengePoints: "set challenge points",
		addChallenges: "add challenges",
		banMember: "ban the member",
		unbanMember: "unban the member",
		removeMember: "remove the member",
		addMember: "add members",
		banTeam: "ban the team",
		unbanTeam: "unban the team",
		deleteTeam: "delete the team",
		deleteAnnouncement: "delete the announcement",
		publishAnnouncement: "publish the announcement",
		saveAnnouncement: "save the announcement",
		loadEventInstances: "load event instances",
		generateWriteupReport: "generate the write-up report",
		loadEventData: "load event data",
		loadAwdStatus: "load AWD status",
		loadAwdScores: "load AWD scores",
		loadAwdpConfig: "load AWDP configuration",
		loadAwdpScores: "load AWDP scores",
	},
	shared: {
		virtual: "Virtual event",
		emptyDescription: "The backend returned no entries.",
	},
	list: {
		documentTitle: "Event management · FloatCTF",
		title: "Event management",
		description:
			"One event = one console: configuration, challenges, members, teams, announcements, instances, logs and runtime summaries all live in the same workspace.",
		create: "New event",
		createDisabledHint:
			"Virtual (practice) events are created by the platform or AWDP flows and cannot be created manually here",
		searchPlaceholder: "Search titles…",
		searchAria: "Search event titles",
		familyFilterAria: "Filter by family",
		familyAll: "All families",
		scopeFilterAria: "Event type",
		scopeCompetition: "Competition",
		scopeVirtual: "Virtual",
		sectionTitleCompetition: "Competition events",
		sectionTitleVirtual: "Virtual (practice) events",
		sectionDescriptionCompetition: "Events with purpose=competition / is_virtual=false.",
		sectionDescriptionVirtual:
			"Events with purpose=practice / is_virtual=true, created by the platform or AWDP flows.",
		footnote:
			"Lists are returned newest-first by updated_at; the time window and status are derived from start_time / end_time.",
		deleteSelected: "Delete selected ({{count}})",
		columns: {
			title: "Title",
			family: "Family",
			participantMode: "Mode",
			window: "Window",
			status: "Status",
			visibility: "Visibility",
			purpose: "Purpose / virtual",
		},
		visibility: {
			hidden: "Hidden",
			public: "Public",
		},
		badgeSystem: "System-managed",
		row: {
			actions: "Actions for {{name}}",
			openConsole: "Open console",
			edit: "Edit event",
			delete: "Delete event",
		},
		delete: {
			singleTitle: "Delete event \"{{title}}\"?",
			bulkTitle: "Delete the {{count}} selected events?",
			description:
				"Deleting an event is irreversible; the backend also tears down its runtime resources.",
			consequence1:
				"The event row is deleted: participants / teams, event challenges, announcements, logs, write-ups and instance records are removed by foreign-key cascade",
			consequence2:
				"Solve records (jeopardy_challenge_solves) are cascade-deleted, so event scores and rankings are no longer available",
			consequence3:
				"AWD / AWDP runtimes are torn down: containers, the event-specific Docker network, WireGuard interfaces and nftables rules are all reclaimed",
			consequence4:
				"System-managed events (non-empty system_key) are rejected by the backend and cannot be deleted by mistake",
			confirm: "Delete event",
			phraseBulk: "delete",
			success: "Deleted {{count}} event(s)",
			failed: "Failed to delete event",
		},
		loadError: "Failed to load events",
		empty: {
			title: "No events yet",
			filteredDescription: "No event title contains “{{query}}”. Clear the search or adjust the filters.",
			filteredTitle: "No matching events",
			descriptionCompetition:
				"No competition events yet. Use “New event” in the top-right to create the first one.",
			descriptionVirtual: "There are no virtual (practice) events right now.",
		},
		mobile: {
			title: "Title",
			family: "Family",
			participantMode: "Mode",
			status: "Status",
			window: "Window",
			purpose: "Purpose",
			visibility: "Visibility",
		},
	},
	console: {
		documentTitle: "{{title}} · Event console · FloatCTF",
		documentTitleFallback: "Event console · FloatCTF",
		missingIdTitle: "Missing event ID",
		missingIdDescription: "The address has no eventId. Open the console from the event list.",
		backToList: "Back to events",
		loading: "Loading event details…",
		forbiddenDescription: "This admin account cannot read the event (the backend returned 403).",
		notFoundTitle: "Event not found",
		notFoundDescription: "The event may have been deleted, or the ID is incorrect.",
		loadError: "Failed to load the event",
		breadcrumb: "Events",
		eventIdLabel: "Event ID",
		awdOps: "AWD operations",
		awdpWorkbench: "AWDP workbench",
		tabsLabel: "Event console tabs",
		tabs: {
			config: "Configuration",
			challenges: "Challenges",
			members: "Members",
			teams: "Teams",
			announcements: "Announcements",
			instances: "Instances",
			logs: "Logs",
			writeups: "Write-ups",
			data: "Dashboard",
			awd: "AWD overview",
			awdp: "AWDP overview",
		},
	},
	form: {
		titleEdit: "Edit event",
		titleCreate: "New event",
		descriptionEdit:
			"Family and participant mode cannot be changed after creation; other fields take effect immediately when saved.",
		descriptionCreate:
			"Family and participant mode cannot be changed after creation, so confirm the format first.",
		submitSave: "Save",
		submitCreate: "Create event",
		readonlyNote:
			"Family and participant mode cannot be changed after creation (the backend PATCH body does not accept these two fields).",
		rulesTemplate: `# Event rules

## 1. Schedule
- The start / end times published on the event page are authoritative

## 2. Participation
- Compete with real information; members and registration details cannot be changed after the deadline

## 3. Scoring
- Each challenge is worth its event points; repeated submissions do not score again
- The leaderboard sorts by total score, with ties broken by who reached the score first

## 4. Flag format
- Flags look like \`flag{...}\`; do not include extra spaces or newlines when submitting

## 5. Fair play
- Do not attack the platform, other participants, or competition infrastructure
- Do not share flags / answers / write-ups; violators lose eligibility and scores
`,
		field: {
			title: "Event title",
			titlePlaceholder: "e.g. Spring 2026 Campus CTF",
			description: "Description",
			descriptionHint: "Up to 10,000 characters; Markdown supported.",
			family: "Family",
			familyHint: "AWD is always a team event.",
			participantMode: "Participant mode",
			participantModeHint: "Cannot be changed after creation.",
			startTime: "Start time",
			endTime: "End time",
			endTimeHintPractice: "Practice (virtual) events may leave this empty.",
			flagPrefix: "Flag prefix",
			flagPrefixHint: "Up to 32 characters, e.g. flag.",
			rules: "Event rules",
			rulesHint: "Markdown supported; up to 50,000 characters.",
			templateButton: "Fill template",
			hidden: "Hide event",
			hiddenHint: "Not visible in the player event list",
			allowJoin: "Allow joining",
			allowJoinHint: "Players can register themselves",
		},
		validation: {
			titleRequired: "The event title is required",
			startRequired: "Select a start time",
			endRequired: "Competition events must have an end time",
			endBeforeStart: "The end time must be later than the start time",
		},
		toast: {
			created: "Event created",
			updated: "Event updated",
			saveFailed: "Failed to save the event",
			createFailed: "Failed to create the event",
		},
	},
	config: {
		identityTitle: "Event identity",
		identityDescription: "Fields fixed at creation (the backend PATCH body does not accept them).",
		editableTitle: "Editable configuration",
		editableDescription:
			"Changes take effect for players immediately; time changes also revalidate AWD / AWDP scheduling.",
		edit: "Edit configuration",
		fields: {
			eventId: "Event ID",
			family: "Family",
			participantMode: "Participant mode",
			purpose: "Purpose",
			virtual: "Virtual event",
			systemManaged: "System-managed",
			createdAt: "Created at",
			updatedAt: "Updated at",
			title: "Title",
			status: "Status",
			window: "Time window",
			flagPrefix: "Flag prefix",
			hidden: "Hidden",
			allowJoin: "Allow joining",
			description: "Description",
			rules: "Event rules",
		},
		hints: {
			immutable: "Cannot be changed after creation",
			virtualDerived: "Derived from purpose=practice",
			systemManaged: "System-managed events cannot be modified or deleted through normal APIs",
			updatedAt: "Sent back with the PATCH request when saving (optimistic concurrency)",
			status: "Derived from start_time / end_time",
		},
		values: {
			virtual: "Virtual",
			formal: "Standard",
			no: "No",
			flagPrefixDefault: "Not set (the backend uses its default)",
			hidden: "Hidden",
			public: "Public",
			allowJoin: "Self join allowed",
			disallowJoin: "Self join disabled",
			descriptionEmpty: "No event description provided.",
			rulesEmpty: "No event rules provided.",
		},
	},
	challenges: {
		title: "Event challenges",
		description:
			"Challenges attached from the library; hidden challenges do not appear to players (visibility is controlled per challenge).",
		addButton: "Add challenges",
		loadError: "Failed to load event challenges",
		toolbar: {
			publishSelected: "Publish selected ({{count}})",
			hideSelected: "Hide selected",
			bulkSetPoints: "Set points",
			removeSelected: "Remove selected",
		},
		columns: {
			challengeId: "Challenge ID",
			name: "Challenge",
			category: "Category",
			points: "Points",
			publishState: "Publish state",
			buildStatus: "Build status",
		},
		values: {
			hidden: "Hidden",
			published: "Published",
		},
		row: {
			actions: "Actions for {{name}}",
			setPoints: "Set points",
			publish: "Publish to players",
			hide: "Hide from players",
			remove: "Remove from event",
		},
		confirm: {
			singleTitle: "Remove \"{{name}}\" from the event?",
			bulkTitle: "Remove the {{count}} selected challenges from the event?",
			description: "Only the event ↔ challenge attachment is removed.",
			consequence1:
				"The challenge disappears from the event list and from players immediately (the challenge itself stays in the library)",
			consequence2: "Existing solve records (jeopardy_challenge_solves) are not deleted",
			consequence3:
				"To bring it back, add it from the library again (points must be set again)",
			confirm: "Remove",
		},
		toast: {
			publishSuccess: "Published {{count}} challenge(s)",
			publishSuccessDescription: "Visible to players immediately (if the event itself is visible).",
			publishFailed: "Failed to publish challenges",
			hideSuccess: "Hidden {{count}} challenge(s)",
			hideFailed: "Failed to hide challenges",
			removeSuccess: "Removed {{count}} challenge(s) from the event",
			removeFailed: "Failed to remove challenges",
			pointsSuccess: "Points updated",
			pointsSuccessDescription:
				"Future solves use the new points; points already awarded are not adjusted retroactively.",
			pointsFailed: "Failed to set points",
		},
		empty: {
			title: "The event has no challenges yet",
			description: "Use “Add challenges” to pick library challenges for this event.",
		},
		mobile: {
			challenge: "Challenge",
			category: "Category",
			points: "Points",
			status: "Status",
		},
		add: {
			title: "Add challenges from the library",
			description:
				"Only challenges with build_status = ready can be added (the backend rejects packages that are not ready). Leave points empty to use the backend default of 100.",
			emptyTitle: "No matching challenges",
			emptyDescription: "Try another keyword, or create and build challenges in the library first.",
			submit: "Add",
			submitWithCount: "Add ({{count}})",
			searchLabel: "Search challenges",
			searchPlaceholder: "Filter by name…",
			pointsLabel: "Points (optional)",
			pointsHint: "1 – 1000000; empty = 100",
			pointsError: "Points must be a positive number no greater than 1000000",
			selectedSummary: "{{total}} challenges · {{selected}} selected on this page",
			pageInfo: "Page {{page}} / {{total}}",
			table: {
				name: "Challenge",
				category: "Category",
				buildStatus: "Build status",
				updatedAt: "Updated",
			},
			mobile: {
				name: "Name",
				category: "Category",
				buildStatus: "Build status",
			},
			toast: {
				success: "Added {{count}} challenge(s)",
				failed: "Failed to add challenges",
			},
		},
		points: {
			title: "Set points for {{count}} challenge(s)",
			description:
				"New solves use the new points after submission; points already awarded are not adjusted retroactively.",
			label: "Points",
			hint: "1 – 1000000",
			error: "Points must be a positive number no greater than 1000000",
			submit: "Save points",
		},
	},
	members: {
		title: "Event members",
		descriptionTeam:
			"Team event: this is the event's participant account pool; see the Teams tab for team membership.",
		descriptionIndividual:
			"Individual event: these members are the participants and can be banned or removed here.",
		alreadyMemberHint: "Accounts already in this event cannot be selected.",
		addButton: "Add members",
		loadError: "Failed to load event members",
		toolbar: {
			unban: "Unban",
			banSelected: "Ban selected",
			removeSelected: "Remove selected",
		},
		columns: {
			user: "Participant",
			points: "Event points",
			status: "Status",
			joinedAt: "Joined at",
		},
		values: {
			banned: "Banned",
			normal: "Normal",
		},
		mobile: {
			user: "Participant",
			points: "Points",
			status: "Status",
		},
		row: {
			actions: "Actions for {{name}}",
			unban: "Unban",
			ban: "Ban",
			teamManaged: "For team events, manage members on the Teams tab",
			remove: "Remove from event",
		},
		confirmBan: {
			title: "Ban \"{{name}}\"?",
			description:
				"The ban applies within this event only and does not affect the account in other events.",
			consequence1:
				"The participant's flag submissions in this event are rejected by the backend (User is banned from this event)",
			consequence2:
				"The participant is removed from the event scoreboard (the backend filters event_users.banned = false)",
			consequence3:
				"The account, participation record and existing solves are kept; use “Unban” to restore at any time",
			confirm: "Ban",
		},
		confirmBulkBan: {
			title: "Ban the {{count}} selected members?",
			description: "The ban applies within this event only.",
			consequence1: "These participants' flag submissions in this event are rejected by the backend",
			consequence2: "They are removed from the event scoreboard (the backend filters banned=false)",
			consequence3: "Accounts and solve records are kept; they can be unbanned at any time",
			confirm: "Ban all",
			phrase: "ban",
		},
		confirmRemove: {
			singleTitle: "Remove \"{{name}}\" from the event?",
			bulkTitle: "Remove the {{count}} selected members from the event?",
			description:
				"This removes the event participation record (event_users), not the platform account.",
			consequence1:
				"The participation record is deleted and the participant no longer appears on the event scoreboard (which is driven by event_users)",
			consequence2: "The platform account and its solve records are not deleted",
			consequence3:
				"Re-adding is required to compete again; points earned before are not restored automatically",
			confirm: "Remove",
		},
		empty: {
			title: "The event has no members yet",
			description: "Use “Add members” to pick participants from platform accounts.",
		},
		toast: {
			banSuccess: "Banned {{count}} member(s)",
			banFailed: "Failed to ban",
			unbanSuccess: "Unbanned {{count}} member(s)",
			unbanFailed: "Failed to unban",
			removeSuccess: "Removed {{count}} member(s) from the event",
			removeFailed: "Failed to remove member(s)",
		},
		add: {
			title: "Add event members",
			descriptionTeam:
				"Team event: this only adds accounts to the event participant pool; it does not join any team (team membership is handled by captains / the platform).",
			descriptionIndividual:
				"Pick participants from platform accounts; duplicate additions are rejected by the backend.",
			alreadyMemberHint: "Accounts already in this event cannot be selected.",
			emptyTitle: "No matching accounts",
			emptyDescription: "Try another nickname keyword.",
			submit: "Add",
			submitWithCount: "Add ({{count}})",
			searchLabel: "Search accounts",
			searchHint: "Filter by nickname (backend filter key: nickname).",
			searchPlaceholder: "Nickname keyword…",
			selectedSummary: "{{total}} accounts · {{selected}} selected on this page",
			table: {
				username: "Username",
				nickname: "Nickname",
				createdAt: "Registered at",
			},
			mobile: {
				username: "Username",
				nickname: "Nickname",
			},
			toast: {
				success: "Added {{count}} member(s)",
				failed: "Failed to add member(s)",
			},
		},
	},
	teams: {
		title: "Event teams",
		descriptionTeam:
			"This is a team event; bans apply per team and the roster comes from the backend's event_team_members.",
		descriptionIndividual:
			"This is an individual event (participant_mode=individual), so team data is usually absent.",
		loadError: "Failed to load event teams",
		member: {
			empty: "No members",
			captain: "Captain",
			member: "Member",
		},
		toolbar: {
			unban: "Unban",
			banSelected: "Ban selected",
			removeSelected: "Delete selected",
		},
		columns: {
			team: "Team",
			captain: "Captain",
			members: "Members",
			points: "Points",
			status: "Status",
			createdAt: "Created at",
		},
		values: {
			banned: "Banned",
			normal: "Normal",
		},
		mobile: {
			team: "Team",
			captain: "Captain",
			members: "Members",
			points: "Points",
			status: "Status",
		},
		row: {
			actions: "Actions for {{name}}",
			unban: "Unban",
			ban: "Ban team",
			remove: "Delete team",
		},
		confirmBan: {
			title: "Ban team \"{{name}}\"?",
			description: "The ban applies within this event only.",
			consequence1:
				"Team members' flag submissions in this event are rejected by the backend (Team is banned from this event)",
			consequence2:
				"The team is removed from the event scoreboard (the backend filters event_teams.banned = false)",
			consequence3:
				"For AWD events, the team's WireGuard / GameBox network is blocked by firewall rules",
			consequence4:
				"The team, its members and solve records are kept; use “Unban” to restore at any time",
			confirm: "Ban",
		},
		confirmBulkBan: {
			title: "Ban the {{count}} selected teams?",
			description: "The ban applies within this event only.",
			consequence1: "These teams' members' flag submissions in this event are rejected by the backend",
			consequence2: "These teams are removed from the event scoreboard",
			consequence3: "Teams and solve records are kept and can be unbanned at any time",
			confirm: "Ban all",
			phrase: "ban",
		},
		confirmRemove: {
			singleTitle: "Delete team \"{{name}}\"?",
			bulkTitle: "Delete the {{count}} selected teams?",
			description: "Deleting a team also cleans up its members' event participation records.",
			consequence1: "The team row and roster (event_team_members) are deleted",
			consequence2:
				"Team members' participation records (event_users) are removed and they disappear from the scoreboard",
			consequence3:
				"The team's solve records are cascade-deleted by the team_id foreign key; results cannot be recovered",
			consequence4:
				"For AWD events, confirm the team's runtime no longer needs to be kept",
			confirm: "Delete team",
			phraseBulk: "delete",
		},
		toast: {
			banSuccess: "Banned {{count}} team(s)",
			banFailed: "Failed to ban team",
			unbanSuccess: "Unbanned {{count}} team(s)",
			unbanFailed: "Failed to unban",
			removeSuccess: "Deleted {{count}} team(s)",
			removeFailed: "Failed to delete team",
		},
		empty: {
			teamTitle: "No teams yet",
			individualTitle: "Individual events have no teams",
			teamDescription:
				"Teams are created by players or assigned by the platform; admins can only view, ban or delete them.",
			individualDescription:
				"This event has participant_mode=individual, so the backend returns no team data.",
		},
	},
	announcements: {
		title: "Event announcements",
		description: "Announcements are visible on the player event page immediately; Markdown supported.",
		publishButton: "Publish announcement",
		loadError: "Failed to load event announcements",
		columns: {
			title: "Title",
			content: "Content",
			createdAt: "Published at",
		},
		row: {
			actions: "Actions for {{name}}",
		},
		confirmRemove: {
			title: "Delete announcement \"{{name}}\"?",
			description: "Deleting an event announcement is irreversible.",
			consequence1: "The announcement disappears from the event page and players immediately",
			consequence2: "The content is not backed up and cannot be recovered (it must be republished)",
			confirm: "Delete announcement",
		},
		toast: {
			deleteSuccess: "Deleted {{count}} announcement(s)",
			deleteFailed: "Failed to delete announcement",
			publishSuccess: "Announcement published",
			updateSuccess: "Announcement updated",
			saveFailed: "Failed to save announcement",
		},
		empty: {
			title: "No announcements yet",
			description: "Publish the first announcement to share schedule and rule changes with players.",
		},
		preview: {
			publishedAt: "Published at {{time}}",
		},
		editor: {
			createTitle: "Publish event announcement",
			editTitle: "Edit event announcement",
			description: "Visible on the player event page immediately after publishing.",
			titleLabel: "Title",
			titlePlaceholder: "e.g. Schedule change notice",
			contentLabel: "Content",
			contentHint:
				"Markdown (GFM) supported. Image uploads are unavailable in the admin console; use external links.",
			submitCreate: "Publish",
			submitUpdate: "Save",
			titleRequired: "The announcement title is required",
		},
		mobile: {
			title: "Title",
			createdAt: "Published at",
			content: "Content",
		},
	},
	instances: {
		title: "Event instances",
		description:
			"A normalized event_instances view (Challenge and GameBox shown together). The admin list does not return flags, so no flag is displayed here.",
		loadError: "Failed to load event instances",
		columns: {
			type: "Type",
			status: "Status",
			identifier: "Identifier",
			content: "Content",
			owner: "Owner",
			generation: "Generation",
			createdAt: "Created at",
			destroyAt: "Destroy at",
		},
		values: {
			ownerTeam: "{{name}} (team)",
		},
		mobile: {
			type: "Type",
			status: "Status",
			identifier: "Identifier",
			content: "Content",
			owner: "Owner",
			destroyAt: "Destroy at",
		},
		empty: {
			title: "The event has no instances",
			description:
				"Instances appear after players launch challenges / GameBoxes, or are created by AWD / AWDP deployment flows.",
			reload: "Reload",
		},
	},
	records: {
		logs: {
			title: "Event operation logs",
			description: "Operation stream recorded for this event (both admin and player actions).",
			loadError: "Failed to load event logs",
			columns: {
				level: "Level",
				action: "Action",
				details: "Details",
				actor: "User / team",
				ip: "IP",
				time: "Time",
			},
			mobile: {
				level: "Level",
				action: "Action",
				details: "Details",
				time: "Time",
			},
			empty: {
				title: "No logs",
				description: "This event has not produced any operation records yet.",
			},
		},
		writeups: {
			title: "Event write-ups",
			description:
				"Write-up files submitted by players / teams; “Export all” asks the backend to generate a report archive for the whole event.",
			exportAll: "Export all",
			loadError: "Failed to load write-ups",
			columns: {
				userId: "User ID",
				teamId: "Team ID",
				file: "File",
				createdAt: "Submitted at",
			},
			mobile: {
				user: "User",
				team: "Team",
				file: "File",
				createdAt: "Submitted at",
			},
			empty: {
				title: "No write-ups",
				description: "Write-ups submitted by players / teams after the event appear here.",
			},
			downloadAria: "Download {{name}}",
			reportKeyMissing:
				"The backend did not return a report object key (the event may have no write-ups yet)",
			toast: {
				downloadSuccess: "Download started",
				downloadFailed: "Download failed",
				exportSuccess: "Downloading the write-up report",
				exportFailed: "Failed to export write-ups",
			},
		},
	},
	data: {
		loadError: "Failed to load event data",
		stats: {
			users: {
				label: "Participants",
				hint: "event_users records",
			},
			teams: {
				label: "Teams",
				hint: "Always 0 for individual events",
			},
			challenges: {
				label: "Challenges",
				hint: "{{count}} solves in total",
			},
			recent: {
				label: "Recent solves",
				hint: "Latest 15 records",
			},
		},
		trend: {
			title: "Total score trend",
			description:
				"Generated by the backend from total-score snapshots; hover to inspect each subject's score.",
		},
		scoreboard: {
			title: "Leaderboard top 10",
			description: "Same source as the player leaderboard (banned=false filter).",
			emptyTitle: "No ranking data",
			emptyDescription: "No team / player has scored yet.",
		},
		challenges: {
			title: "Challenge solve stats",
			description: "Sorted by solve count descending (server-side order).",
			emptyTitle: "The event has no challenges yet",
			emptyDescription: "Once challenges are attached, solve rates and dynamic points appear here.",
		},
		recent: {
			title: "Recent solves",
			description: "The latest 15 solve records (including bonus points).",
			emptyTitle: "No solve records",
			emptyDescription: "No player has solved an event challenge yet.",
		},
		columns: {
			challenge: "Challenge",
			category: "Category",
			points: "Current points",
			solvedCount: "Solves",
			solvedPercent: "Solve rate",
			rank: "#",
			name: "Player / team",
			score: "Total score",
			solveCount: "Solves",
			user: "Player",
			solveTime: "Solved at",
		},
		mobile: {
			rank: "#",
			name: "Name",
			score: "Total score",
			challenge: "Challenge",
			category: "Category",
			points: "Current points",
			solved: "Solved",
			solvedValue: "{{count}} solves / {{percent}}",
			user: "Player",
			bonus: "Bonus",
			time: "Time",
		},
	},
	ops: {
		awd: {
			summaryTitle: "AWD runtime summary",
			summaryDescription:
				"Read-only snapshot; deploy / start / pause / finish / archive / precheck from the AWD operations page.",
			openOps: "Open AWD operations",
			loading: "Loading AWD status…",
			loadError: "Failed to load AWD status",
			emptyTitle: "AWD is not configured for this event",
			emptyDescription:
				"The backend returned an empty status: no awd_events configuration row exists. Create one on the AWD operations page.",
			goToOps: "Go to AWD operations",
			networkError:
				"The backend reports network_error: platform infrastructure is failing, the match is paused and an administrator must recover it on the operations page.",
			finalSettlement:
				"Final settlement (final_settlement): the Judge is settling the last round and match actions are closed.",
			phases: {
				hardening: "Hardening phase",
				attack: "Attack phase",
				pause: "Paused (administrator action)",
			},
			stats: {
				status: {
					label: "Status",
					hint: "Raw backend awd_events.status value",
				},
				phase: {
					label: "Phase",
					hintFallback: "Raw backend phase value",
				},
				rounds: {
					label: "Rounds",
					unset: "Not set",
					hint: "{{duration}} per round",
				},
				initialScore: {
					label: "Initial score",
					hint: "{{free}} free resets · {{penalty}} extra-reset penalty",
				},
			},
			fields: {
				plannedStart: {
					key: "Planned start",
					unset: "Not set",
				},
				startedAt: {
					key: "Actual start",
					notStarted: "Not started",
				},
				verifiedAt: {
					key: "Precheck passed at",
					notVerified: "Not verified",
				},
				judge: {
					key: "Judge concurrency / timeout",
					value: "{{concurrency}} concurrent · {{timeout}} timeout",
				},
				judgeRetry: {
					key: "Judge retry interval",
				},
				archiveRetention: {
					key: "Archive retention",
					value: "{{hours}} hours",
				},
				updatedAt: {
					key: "Status updated at",
				},
			},
			scores: {
				title: "AWD leaderboard",
				description: "Raw ranking from the backend `awd.admin.scores`.",
				loading: "Loading AWD scores…",
				loadError: "Failed to load AWD scores",
				emptyTitle: "No AWD scores",
				emptyDescription: "Data appears once the match starts and scores are produced.",
			},
			columns: {
				rank: "#",
				team: "Team",
				attack: "Attack",
				defense: "Defense",
				total: "Total",
			},
			mobile: {
				rank: "#",
				team: "Team",
				attack: "Attack",
				defense: "Defense",
				total: "Total",
			},
		},
		awdp: {
			summaryTitle: "AWDP configuration summary",
			summaryDescription:
				"Read-only configuration and phase snapshot; advance phases (start / break-to-fix / finish) and manage GameBoxes in the AWDP workbench.",
			openWorkbench: "Open AWDP workbench",
			loading: "Loading AWDP configuration…",
			loadError: "Failed to load AWDP configuration",
			phases: {
				pending: "Pending",
				break: "Break (attack)",
				preparingFix: "Preparing fix (transition)",
				fix: "Fix",
				ended: "Ended",
			},
			stats: {
				phase: {
					label: "Phase",
					hintFallback: "Raw backend phase value",
				},
				round: {
					label: "Current round",
					hint: "Configuration generation {{generation}}",
				},
				break: {
					label: "Break duration / points",
					hint: "{{score}} points per challenge",
				},
				fix: {
					label: "Fix duration / points",
					hint: "{{score}} points per round · {{interval}} between rounds",
				},
			},
			fields: {
				startedAt: {
					key: "Start time",
					notStarted: "Not started",
				},
				breakEndsAt: {
					key: "Break ends at",
				},
				fixRange: {
					key: "Fix start / end",
				},
				finishedAt: {
					key: "End time",
					notFinished: "Not finished",
				},
				nextActionAt: {
					key: "Next action at",
				},
				updatedAt: {
					key: "Configuration updated at",
				},
			},
			scores: {
				title: "AWDP leaderboard",
				description: "Raw ranking from the backend `awdp.admin.scores`.",
				loading: "Loading AWDP scores…",
				loadError: "Failed to load AWDP scores",
				emptyTitle: "No AWDP scores",
				emptyDescription: "Data appears once Break / Fix scoring starts.",
			},
			columns: {
				rank: "#",
				subject: "Player / team",
				breakScore: "Break points",
				fixScore: "Fix points",
				total: "Total",
			},
			mobile: {
				rank: "#",
				subject: "Player / team",
				breakScore: "Break points",
				fixScore: "Fix points",
				total: "Total",
			},
		},
	},
};
