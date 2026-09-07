/**
 * Creates the controller for opening, editing and safely closing a track detail dialog.
 * @param {object} dependencies Services supplied by Trailthread's main application module.
 * @param {object} dependencies.state Trailthread application state.
 * @param {object} dependencies.el Detail dialog elements.
 * @param {(value: unknown) => string} dependencies.cleanText Normalizes editable text values.
 * @param {(key: string, values?: object) => string} dependencies.translate Resolves translated user-facing text.
 * @param {(value: string) => string[]} dependencies.parseTagInput Parses the editable tag field.
 * @param {(value: unknown) => string[]} dependencies.normalizeTagList Normalizes saved tag values.
 * @param {(message: string, options: object) => Promise<boolean>} dependencies.confirmAction Confirms destructive actions.
 * @param {() => void} dependencies.renderTrackDetailDialog Renders the current detail dialog state.
 * @param {(message: string, error?: boolean, persistent?: boolean) => void} dependencies.setStatus Displays application feedback.
 * @param {() => Set<number>} dependencies.getRemovedPhotoIndexes Returns photos marked for deletion.
 * @param {(indexes: Set<number>) => void} dependencies.setRemovedPhotoIndexes Replaces marked photo indexes.
 * @returns {{open: (trackId: string, startEditing?: boolean) => void, hasUnsavedChanges: () => boolean, requestClose: () => Promise<void>, markPhotoForDeletion: (trackId: string, photoIndex: number) => Promise<void>}} Detail-dialog operations.
 */
export function createTrackDetailController(dependencies) {
  /**
   * Opens a track in the detail dialog and optionally switches straight to editing.
   * @param {string} trackId Identifier of the track to display.
   * @param {boolean} [startEditing=false] Whether editing should start immediately.
   * @returns {void} Does not return a value.
   */
  function open(trackId, startEditing = false) {
    const track = dependencies.state.tracks.find((item) => item.id === trackId);
    if (!track) return;
    dependencies.state.trackDetailUi.trackId = track.id;
    dependencies.state.trackDetailUi.editing = !!startEditing;
    dependencies.setRemovedPhotoIndexes(new Set());
    dependencies.renderTrackDetailDialog();
    dependencies.el.trackDetailDialog.showModal();
    if (startEditing) {
      queueMicrotask(() => {
        dependencies.el.trackDetailNameInput?.focus();
        dependencies.el.trackDetailNameInput?.select();
      });
    }
  }

  /**
   * Checks whether the edit form has fields or photo removals not yet saved.
   * @returns {boolean} True when closing would discard changes.
   */
  function hasUnsavedChanges() {
    const track = dependencies.state.tracks.find((item) => item.id === dependencies.state.trackDetailUi.trackId);
    if (!track || !dependencies.state.trackDetailUi.editing) return false;
    const nextName = dependencies.cleanText(dependencies.el.trackDetailNameInput?.value) || track.name || dependencies.translate('unnamedTrack');
    const nextDescription = dependencies.cleanText(dependencies.el.trackDetailDescriptionInput?.value);
    const nextFavorite = !!dependencies.el.trackDetailFavoriteInput?.checked;
    const nextTags = dependencies.parseTagInput(dependencies.el.trackDetailTagsInput?.value);
    const currentTags = dependencies.normalizeTagList(track.tags);
    if (dependencies.getRemovedPhotoIndexes().size) return true;
    if (nextName !== track.name) return true;
    if (nextDescription !== dependencies.cleanText(track.description)) return true;
    if (nextFavorite !== !!track.favorite) return true;
    if (nextTags.length !== currentTags.length) return true;
    for (let index = 0; index < nextTags.length; index += 1) {
      if (nextTags[index] !== currentTags[index]) return true;
    }
    return false;
  }

  /**
   * Closes the dialog after the user confirms discarding unsaved detail edits.
   * @returns {Promise<void>} Resolves after closing or retaining the edit form.
   */
  async function requestClose() {
    if (!hasUnsavedChanges()) {
      dependencies.el.trackDetailDialog.close();
      return;
    }
    const discardChanges = await dependencies.confirmAction(dependencies.translate('confirmDiscardTrackChanges'), {
      title: dependencies.translate('discardTrackChangesTitle'),
      confirmLabel: dependencies.translate('discardTrackChangesConfirm'),
      cancelLabel: dependencies.translate('discardTrackChangesCancel'),
    });
    if (discardChanges) dependencies.el.trackDetailDialog.close();
  }

  /**
   * Marks an edited track photo for deletion after explicit confirmation.
   * @param {string} trackId Identifier of the track that owns the photo.
   * @param {number} photoIndex Zero-based position of the photo in the track.
   * @returns {Promise<void>} Resolves after the dialog has been refreshed.
   */
  async function markPhotoForDeletion(trackId, photoIndex) {
    const track = dependencies.state.tracks.find((item) => item.id === trackId);
    if (!track || !Array.isArray(track.photos)) return;
    const photo = track.photos[photoIndex];
    if (!photo) return;
    const confirmed = await dependencies.confirmAction(dependencies.translate('confirmDeleteTrackPhoto'), {
      title: dependencies.translate('deleteTrackPhotoTitle'),
      confirmLabel: dependencies.translate('deleteTrackPhotoConfirm'),
      cancelLabel: dependencies.translate('deleteTrackPhotoCancel'),
    });
    if (!confirmed) return;
    const draft = {
      name: dependencies.el.trackDetailNameInput?.value || '',
      description: dependencies.el.trackDetailDescriptionInput?.value || '',
      favorite: !!dependencies.el.trackDetailFavoriteInput?.checked,
      tags: dependencies.el.trackDetailTagsInput?.value || '',
    };
    const removedPhotoIndexes = dependencies.getRemovedPhotoIndexes();
    removedPhotoIndexes.add(photoIndex);
    dependencies.setRemovedPhotoIndexes(removedPhotoIndexes);
    dependencies.renderTrackDetailDialog();
    dependencies.el.trackDetailNameInput.value = draft.name;
    dependencies.el.trackDetailDescriptionInput.value = draft.description;
    dependencies.el.trackDetailFavoriteInput.checked = draft.favorite;
    dependencies.el.trackDetailTagsInput.value = draft.tags;
    dependencies.setStatus(dependencies.translate('trackPhotoMarkedForDeletion'));
  }

  return { open, hasUnsavedChanges, requestClose, markPhotoForDeletion };
}
