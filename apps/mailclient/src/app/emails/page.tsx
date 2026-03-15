'use client';

import { useEmailState } from '@/hooks/useEmailState';
import { useEmailResize } from '@/hooks/useEmailResize';
import EmailPageLayout from '@/components/EmailPageLayout';

export default function EmailsPage() {
  const emailState = useEmailState();
  const emailResize = useEmailResize(emailState.layoutPreferences, emailState.saveLayoutPreferences);

  return (
    <EmailPageLayout
      // States (von useEmailState)
      emails={emailState.emails}
      loading={emailState.loading}
      loadingMore={emailState.loadingMore}
      error={emailState.error}
      searchQuery={emailState.searchQuery}
      filter={emailState.filter}
      selectedEmails={emailState.selectedEmails}
      selectedEmailId={emailState.selectedEmailId}
      selectedEmailDetails={emailState.selectedEmailDetails}
      loadingEmailDetails={emailState.loadingEmailDetails}
      markingRead={emailState.markingRead}
      markingCompleted={emailState.markingCompleted}
      markingSpam={emailState.markingSpam}
      markingImportant={emailState.markingImportant}
      fetching={emailState.fetching}
      fetchMessage={emailState.fetchMessage}
      page={emailState.page}
      limit={emailState.limit}
      totalPages={emailState.totalPages}
      total={emailState.total}
      hasNext={emailState.hasNext}
      hasPrevious={emailState.hasPrevious}
      searchFields={emailState.searchFields}
      tableColumns={emailState.tableColumns}
      unreadCount={emailState.unreadCount}
      customFilterId={emailState.customFilterId}
      
      // Handlers (von useEmailState)
      onSearchQueryChange={emailState.setSearchQuery}
      onFilterChange={emailState.setFilter}
      onEmailClick={emailState.handleEmailClick}
      onSelectAll={emailState.handleSelectAll}
      onSelectEmail={emailState.handleSelectEmail}
      onToolbarMarkAsRead={emailState.handleToolbarMarkAsRead}
      onToolbarMarkAsCompleted={emailState.handleToolbarMarkAsCompleted}
      onToolbarMarkAsSpam={emailState.handleToolbarMarkAsSpam}
      onToolbarMarkAsImportant={emailState.handleToolbarMarkAsImportant}
      onToolbarDelete={emailState.handleToolbarDelete}
      onRestoreEmail={emailState.handleRestoreEmail}
      onFetchEmails={emailState.handleFetchEmails}
      onRefresh={emailState.handleRefresh}
      onDepartmentChange={emailState.handleDepartmentChange}
      onPageChange={emailState.setPage}
      onSearchFieldsChange={emailState.handleSearchFieldsChange}
      onSearchReset={emailState.handleSearchReset}
      onMarkAsRead={emailState.handleMarkAsRead}
      onDeleteEmail={emailState.handleDeleteEmail}
      formatDate={emailState.formatDate}
      formatDateForTable={emailState.formatDateForTable}
      formatDateForPreview={emailState.formatDateForPreview}
      onEmailHover={emailState.prefetchEmailDetails}
      focusNotesOnMount={emailState.focusNotesOnMount}
      onAddNote={emailState.handleAddNote}
      
      // Resize (von useEmailResize)
      listWidth={emailResize.listWidth}
      timelineHeight={emailResize.timelineHeight}
      isTimelineCollapsed={emailResize.isTimelineCollapsed}
      isResizing={emailResize.isResizing}
      onHorizontalResizeStart={emailResize.handleHorizontalResizeStart}
      onVerticalResizeStart={emailResize.handleVerticalResizeStart}
      onResizeMove={emailResize.handleResizeMove}
      onResizeEnd={emailResize.handleResizeEnd}
      onResizeLeave={emailResize.handleResizeLeave}
      onToggleTimeline={emailResize.toggleTimeline}
      showThreadView={emailState.layoutPreferences?.showThreadView ?? false}
      onShowThreadViewChange={(value) => emailState.saveLayoutPreferences({ showThreadView: value })}
      layoutPreferences={emailState.layoutPreferences}
      saveLayoutPreferences={emailState.saveLayoutPreferences}
      onLoadMore={emailState.handleLoadMore}
    />
  );
}
