/** adminCommunity domain copy (English). */

export default {
	common: {
		searchPlaceholder: "Search",
		listSeparator: ", ",
		deleteSelected: "Delete selected",
		deleteSelectedCount: "Delete selected ({{count}})",
		deleteSelectedHint: "Select the rows you want to delete first",
		noContent: "(No body)",
		pageOutOfRangeTitle: "No data on this page",
		pageOutOfRangeDescription: "These rows may have just been deleted; reset the page.",
		pageOutOfRangeAction: "Back to page 1",
	},
	announcements: {
		documentTitle: "Announcements · FloatCTF Admin",
		title: "Announcements",
		subtitle: "Create, revise, and delete platform announcements. All users can see them.",
		badge: "All users",
		actions: {
			create: "New announcement",
		},
		section: {
			title: "Announcement list",
			description: "Search matches the title or body; newest update first.",
		},
		search: {
			placeholder: "Search titles or body",
		},
		columns: {
			id: "ID",
			title: "Title",
			content: "Content",
			publisher: "Publisher",
			createdAt: "Created",
			updatedAt: "Updated",
		},
		publisher: {
			deleted: "Deleted account",
			deletedSuffix: "{{name}} (deleted)",
		},
		rowActions: {
			aria: "Announcement actions",
			edit: "Edit",
			delete: "Delete",
		},
		empty: {
			title: "No announcements",
			description: "Create an announcement and its publish time and publisher will appear here.",
			action: "New announcement",
		},
		filtered: {
			title: "No matching announcements",
			description: "No announcement title or body contains “{{query}}”.",
			clear: "Clear search",
		},
		errors: {
			load: "Failed to load announcements",
		},
		requests: {
			create: "Create announcement",
			update: "Update announcement",
			delete: "Delete announcement",
		},
		confirm: {
			deleteTitleSingle: "Delete this announcement?",
			deleteTitleMany: "Delete {{count}} announcements?",
			descriptionMany: "Includes: {{titles}}",
			descriptionManyMore: "Includes: {{titles}} and {{count}} in total",
			consequenceVisibility:
				"The player announcement list drops these entries immediately, affecting every signed-in user.",
			consequenceIrreversible:
				"This cannot be undone; the announcement body is not retained.",
			confirm: "Delete",
		},
		toasts: {
			deleted: "Deleted {{count}} announcements",
			deleteFailed: "Failed to delete announcements",
			created: "Announcement created",
			createFailed: "Failed to create the announcement",
			updated: "Announcement updated",
			updateFailed: "Failed to update the announcement",
		},
		form: {
			createTitle: "New announcement",
			editTitle: "Edit announcement",
			descriptionCreate: "The announcement is visible to all users right after publishing.",
			descriptionEdit:
				"New content is visible after users refresh; the publisher and publish time stay unchanged.",
			titleLabel: "Title",
			titlePlaceholder: "Summarize this notice in one sentence",
			titleRequired: "Title cannot be empty",
			contentLabel: "Body",
			contentHint:
				"Plain text; line breaks are preserved (the player side renders it verbatim without Markdown).",
			contentPlaceholder: "State the time, scope, and impact…",
			submitCreate: "Publish",
			submitEdit: "Save",
			idHint: "ID {{id}}",
			requiredHint: "Title is required",
		},
	},
	discussions: {
		documentTitle: "Discussions · FloatCTF Admin",
		title: "Discussions",
		subtitle:
			"The list is read-only; you can delete discussions and their comments. Select a title to open the detail drawer.",
		section: {
			title: "Discussion list",
			description:
				"Newest update first; search only matches titles (the backend filter does not support the body).",
		},
		search: {
			placeholder: "Search titles",
		},
		columns: {
			id: "ID",
			title: "Title",
			author: "Author",
			views: "Views",
			likes: "Likes",
			comments: "Comments",
			createdAt: "Created",
			updatedAt: "Updated",
		},
		interactions: {
			views: "{{count}} views",
			likes: "{{count}} likes",
			comments: "{{count}} comments",
			mobile: "{{views}} views · {{likes}} likes · {{comments}} comments",
		},
		rowActions: {
			aria: "Discussion actions",
			view: "View details",
			delete: "Delete",
		},
		empty: {
			title: "No discussions",
			description: "Discussions appear here after players publish one.",
		},
		filtered: {
			title: "No matching discussions",
			description: "No discussion title contains “{{query}}”.",
			clear: "Clear search",
		},
		errors: {
			load: "Failed to load discussions",
		},
		requests: {
			detail: "Discussion details",
			delete: "Delete discussion",
			commentDelete: "Delete comment",
		},
		confirm: {
			deleteTitleSingle: "Delete this discussion?",
			deleteTitleMany: "Delete {{count}} discussions?",
			descriptionMany: "Includes: {{titles}}",
			descriptionManyMore: "Includes: {{titles}} and {{count}} in total",
			consequenceContent:
				"The discussion body and all its comments are deleted together; players can no longer access them.",
			consequenceIrreversible: "This cannot be undone.",
			confirm: "Delete",
		},
		toasts: {
			deleted: "Deleted {{count}} discussions",
			deleteFailed: "Failed to delete discussions",
		},
		detail: {
			titleFallback: "Discussion details",
			idLabel: "Discussion ID",
			loading: "Loading the discussion…",
			loadFailed: "Failed to load the discussion",
			authorLabel: "Author",
			views: "{{count}} views",
			likes: "{{count}} likes",
			comments: "{{count}} comments",
			createdLabel: "Created",
			updatedLabel: "Updated",
			contentTitle: "Body",
			commentsTitle: "Comments",
			commentsRefresh: "Refresh comments",
			commentsLoading: "Loading comments…",
			commentsLoadFailed: "Failed to load comments",
			commentsEmptyTitle: "No comments",
			commentsEmptyDescription: "No one has replied to this discussion yet.",
			commentsTruncated: "Showing the latest {{shown}} comments ({{total}} in total).",
			reply: "Reply",
			deleteCommentAria: "Delete comment",
			confirmComment: {
				title: "Delete this comment?",
				consequenceRemoved: "The comment is removed from the discussion permanently.",
				consequenceCascade:
					"All replies under it are deleted too (parent_id ON DELETE CASCADE).",
				consequenceCount:
					"The discussion comment count drops accordingly; this cannot be undone.",
				confirm: "Delete comment",
			},
			toasts: {
				commentDeleted: "Comment deleted",
				commentDeleteFailed: "Failed to delete the comment",
			},
		},
	},
	weapons: {
		documentTitle: "Arsenal · FloatCTF Admin",
		title: "Arsenal",
		subtitle:
			"Tools, scripts, and exploit code shared across the platform. Attachments live in object storage under the `weapon` field.",
		badge: "Shared",
		actions: {
			create: "New weapon",
		},
		section: {
			title: "Weapon list",
			description:
				"Search and pagination run on this page: the admin weapons endpoint returns every entry at once and no pagination meta.",
		},
		search: {
			placeholder: "Search name, category, or description",
		},
		columns: {
			name: "Name",
			category: "Category",
			description: "Description",
			file: "Attachment",
			downloadCount: "Downloads",
			updatedAt: "Updated",
		},
		file: {
			open: "Open the attachment for {{name}}",
			markedNoUrl: "Missing file URL",
			hasFile: "Has attachment",
			noFile: "No attachment",
		},
		rowActions: {
			aria: "Weapon actions",
			edit: "Edit",
			openFile: "Open attachment",
			delete: "Delete",
		},
		upload: {
			action: "Upload",
			progress: "{{percent}}%",
			titleUpload: "Upload attachment",
			titleReplace: "Replace attachment (overwrite)",
			success: "Attachment uploaded",
			successDescription: "{{weapon}} · {{file}}",
			failed: "Failed to upload the attachment",
		},
		mobile: {
			meta: "{{category}} · {{downloads}} downloads",
			noDescription: "(No description)",
		},
		empty: {
			title: "No weapons",
			description:
				"Create a weapon to upload an attachment and manage its download entry.",
			action: "New weapon",
		},
		filtered: {
			title: "No matching weapons",
			description: "No weapon name, category, or description contains “{{query}}”.",
			clear: "Clear search",
		},
		errors: {
			load: "Failed to load the arsenal",
		},
		requests: {
			create: "Create weapon",
			update: "Update weapon",
			delete: "Delete weapon",
		},
		confirm: {
			deleteTitleSingle: "Delete this weapon?",
			deleteTitleMany: "Delete {{count}} weapons?",
			descriptionMany: "Includes: {{titles}}",
			descriptionManyMore: "Includes: {{titles}} and {{count}} in total",
			consequencePlayers:
				"The player arsenal drops these entries immediately; downloaded files stay in object storage but are no longer reachable here.",
			consequenceIrreversible: "This cannot be undone.",
			confirm: "Delete",
		},
		toasts: {
			deleted: "Deleted {{count}} weapons",
			deleteFailed: "Failed to delete weapons",
			created: "Weapon created",
			createFailed: "Failed to create the weapon",
			updated: "Weapon updated",
			updateFailed: "Failed to update the weapon",
		},
		form: {
			createTitle: "New weapon",
			editTitle: "Edit weapon",
			description:
				"Upload the attachment separately with the row-level Upload button (field name `weapon`).",
			nameLabel: "Name",
			nameRequired: "Name cannot be empty",
			categoryLabel: "Category",
			categoryPlaceholder: "e.g. web / pwn / misc",
			categoryRequired: "Category cannot be empty",
			descriptionLabel: "Description",
			fileUrlLabel: "File URL",
			fileUrlHint:
				"Object storage key; written by the backend after an upload (for example weapons/xxx.zip).",
			downloadCountLabel: "Download count",
			downloadCountHint: "Usually incremented by player downloads.",
			hasFileLabel: "Has attachment",
			hasFileHint: "When on, the player side shows a download entry.",
			submitCreate: "Create",
			submitEdit: "Save",
			idHint: "ID {{id}}",
			requiredHint: "Name and category are required",
		},
	},
};
