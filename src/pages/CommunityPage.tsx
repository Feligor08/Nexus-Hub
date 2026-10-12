import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Post, Comment } from '../types/platform';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  ThumbsUp,
  Plus,
  Send,
  User as UserIcon,
  Tag,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Trash2,
  Shield,
  LogIn,
  Search,
  Edit2,
  Flag,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const CommunityPage: React.FC = () => {
  const { currentUser, isAuthenticated, isModerator, isAdmin, openAuthModal } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('DevOps');
  const [newTags, setNewTags] = useState('Docker, HomeServer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit post form state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('DevOps');
  const [editTags, setEditTags] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  // Report modal state
  const [reportingItem, setReportingItem] = useState<{
    type: 'post' | 'comment';
    id: string;
    postId?: string;
    title?: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const categories = [
    { id: 'all', label: 'Alle Themen' },
    { id: 'DevOps', label: 'DevOps & Server' },
    { id: 'Programming', label: 'C# & Software' },
    { id: 'ITA', label: 'ITA Ausbildung & 8051' },
    { id: 'Minecraft', label: 'Minecraft & Fabric' },
    { id: '3D Printing', label: '3D-Druck & Bambu' },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadPosts = async () => {
    try {
      const data = await api.getPosts(
        selectedCategory !== 'all' ? selectedCategory : undefined,
        searchQuery.trim() || undefined,
        selectedTag || undefined
      );
      setPosts(data);
      if (activePost) {
        const refreshed = data.find((p) => p.id === activePost.id);
        if (refreshed) setActivePost(refreshed);
      }
    } catch (e) {
      console.error('Failed to load posts:', e);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [selectedCategory, selectedTag]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPosts();
  };

  const handleLike = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    try {
      const likes = await api.likePost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes } : p)));
      if (activePost && activePost.id === postId) {
        setActivePost({ ...activePost, likes });
      }
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!activePost || !commentInput.trim()) return;

    try {
      const comm = await api.addComment(activePost.id, commentInput.trim());
      const updated = { ...activePost, comments: [...activePost.comments, comm] };
      setActivePost(updated);
      setPosts((prev) => prev.map((p) => (p.id === activePost.id ? updated : p)));
      setCommentInput('');
      showToast('Kommentar hinzugefügt');
    } catch (err) {
      console.error('Failed to comment:', err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await api.createPost({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        tags: tagsArray,
      });
      setPosts((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      showToast('Beitrag erfolgreich erstellt!');
    } catch (err: any) {
      alert(err.message || 'Fehler beim Erstellen des Beitrags');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditPost = (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPost(post);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditCategory(post.category);
    setEditTags(post.tags.join(', '));
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;

    setIsUpdatingPost(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await api.updatePost(editingPost.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
        tags: tagsArray,
      });

      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
      setEditingPost(null);
      showToast('Beitrag erfolgreich aktualisiert');
    } catch (err: any) {
      alert(err.message || 'Fehler beim Bearbeiten des Beitrags');
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Diesen Beitrag wirklich unwiderruflich löschen?')) return;
    try {
      await api.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (activePost?.id === postId) {
        setActivePost(null);
      }
      showToast('Beitrag gelöscht');
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen');
    }
  };

  const startEditComment = (comm: Comment) => {
    setEditingCommentId(comm.id);
    setEditCommentContent(comm.content);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!activePost || !editCommentContent.trim()) return;
    try {
      const updated = await api.updateComment(activePost.id, commentId, editCommentContent.trim());
      const updatedComments = activePost.comments.map((c) => (c.id === commentId ? updated : c));
      const updatedPost = { ...activePost, comments: updatedComments };
      setActivePost(updatedPost);
      setPosts((prev) => prev.map((p) => (p.id === activePost.id ? updatedPost : p)));
      setEditingCommentId(null);
      showToast('Kommentar bearbeitet');
    } catch (err: any) {
      alert(err.message || 'Fehler beim Bearbeiten des Kommentars');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activePost) return;
    if (!confirm('Diesen Kommentar wirklich löschen?')) return;
    try {
      await api.deleteComment(activePost.id, commentId);
      const updatedComments = activePost.comments.filter((c) => c.id !== commentId);
      const updatedPost = { ...activePost, comments: updatedComments };
      setActivePost(updatedPost);
      setPosts((prev) => prev.map((p) => (p.id === activePost.id ? updatedPost : p)));
      showToast('Kommentar gelöscht');
    } catch (err: any) {
      alert(err.message || 'Löschen fehlgeschlagen');
    }
  };

  const handleOpenReport = (type: 'post' | 'comment', id: string, postId?: string, title?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setReportingItem({ type, id, postId, title });
    setReportReason('');
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingItem || !reportReason.trim()) return;

    setIsSubmittingReport(true);
    try {
      if (reportingItem.type === 'post') {
        await api.reportPost(reportingItem.id, reportReason.trim());
      } else {
        await api.reportComment(reportingItem.postId!, reportingItem.id, reportReason.trim());
      }
      setReportingItem(null);
      showToast('Vielen Dank! Der Inhalt wurde an das Moderationsteam gemeldet.');
    } catch (err: any) {
      alert(err.message || 'Meldung fehlgeschlagen');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-150">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-2xs text-emerald-400 hover:text-white">
            Schließen
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">Entwickler Community</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Wissensaustausch &amp; Praxistipps</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Diskutiere über Home-Server, Fabric Modding, C# MVVM, 8051 Assembler und 3D-Druck.
          </p>
        </div>

        <button
          onClick={() => {
            if (!isAuthenticated) {
              openAuthModal('login');
            } else {
              setShowCreateModal(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer self-start sm:self-center shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Neuer Beitrag</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Filter */}
        <div className="flex items-center gap-1.5 p-1 liquid-glass rounded-xl overflow-x-auto scrollbar-none border border-white/10 flex-1">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCategory(c.id);
                setSelectedTag(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === c.id && !selectedTag
                  ? 'bg-white text-black font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Beiträge durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 w-56"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 glass-2 border border-white/15 text-white text-xs font-semibold rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            Suchen
          </button>
        </form>
      </div>

      {/* Active Tag Filter Indicator */}
      {selectedTag && (
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span>Gefiltert nach Tag:</span>
          <span className="px-2.5 py-0.5 bg-white/10 border border-white/20 text-white rounded-lg font-mono">
            #{selectedTag}
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className="text-2xs text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Filter entfernen
          </button>
        </div>
      )}

      {/* Main Grid: Posts List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Posts feed (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {posts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 liquid-glass rounded-xl border border-white/10">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
              <p className="text-sm font-semibold text-zinc-300">Keine Beiträge gefunden</p>
              <p className="text-xs text-zinc-500 mt-1">
                {searchQuery || selectedTag ? 'Versuche einen anderen Suchbegriff oder Tag-Filter.' : 'Erstelle den ersten Beitrag!'}
              </p>
            </div>
          ) : (
            posts.map((post) => {
              const isAuthor = currentUser?.id === post.authorId;
              const canModerate = isModerator || isAdmin;

              return (
                <div
                  key={post.id}
                  onClick={() => setActivePost(post)}
                  className={`p-6 liquid-glass liquid-glass-hover rounded-xl border transition-all cursor-pointer space-y-3 relative group ${
                    activePost?.id === post.id ? 'border-white/40 ring-1 ring-white/20' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-2xs text-zinc-400">
                      <img
                        src={post.authorAvatar || '/src/assets/images/avatar_ita_developer_1790662143237.jpg'}
                        alt={post.authorName}
                        className="w-5 h-5 rounded-full object-cover border border-white/20"
                      />
                      <span className="font-semibold text-white">{post.authorName}</span>
                      {post.authorUsername && <span>(@{post.authorUsername})</span>}
                      <span aria-hidden="true">·</span>
                      <span>{post.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(post.createdAt).toLocaleDateString('de-DE')}</span>
                    </div>

                    {/* Actions: Edit, Delete, Report */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(isAuthor || canModerate) && (
                        <button
                          onClick={(e) => startEditPost(post, e)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          title="Beitrag bearbeiten"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(isAuthor || canModerate) && (
                        <button
                          onClick={(e) => handleDeletePost(post.id, e)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Beitrag löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isAuthor && (
                        <button
                          onClick={(e) => handleOpenReport('post', post.id, undefined, post.title, e)}
                          className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Beitrag melden"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white leading-snug">{post.title}</h3>
                  <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-2xs text-zinc-400">
                    <div className="flex flex-wrap gap-1">
                      {post.tags.map((t, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTag(t);
                          }}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-zinc-300 transition-colors cursor-pointer"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => handleLike(post.id, e)}
                        className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{post.likes}</span>
                      </button>
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.comments.length}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Discussion / Detail Panel */}
        <div className="space-y-4">
          {activePost ? (
            <div className="p-6 liquid-glass rounded-xl border border-white/10 space-y-4 sticky top-24 max-h-[85vh] flex flex-col justify-between">
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider">Diskussion</span>
                  <button onClick={() => setActivePost(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white">{activePost.title}</h4>
                  {(currentUser?.id === activePost.authorId || isModerator || isAdmin) && (
                    <button
                      onClick={(e) => startEditPost(activePost, e)}
                      className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                      title="Beitrag bearbeiten"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {activePost.content}
                </div>

                {/* Comments list */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-2xs font-semibold text-zinc-400 block">
                    Kommentare ({activePost.comments.length}):
                  </span>
                  {activePost.comments.length === 0 ? (
                    <p className="text-2xs text-zinc-500 py-2">Noch keine Antworten. Schreibe die erste!</p>
                  ) : (
                    activePost.comments.map((comm) => {
                      const isCommAuthor = currentUser?.id === comm.authorId;
                      const canModComm = isModerator || isAdmin;

                      return (
                        <div key={comm.id} className="p-2.5 liquid-glass rounded-lg border border-white/5 space-y-1 relative group">
                          <div className="flex items-center justify-between text-2xs text-zinc-400">
                            <span className="font-semibold text-zinc-200">{comm.authorName}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isCommAuthor && (
                                <button
                                  onClick={() => startEditComment(comm)}
                                  className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                                  title="Kommentar bearbeiten"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              {(isCommAuthor || canModComm) && (
                                <button
                                  onClick={() => handleDeleteComment(comm.id)}
                                  className="text-zinc-500 hover:text-rose-400 p-0.5 cursor-pointer"
                                  title="Kommentar löschen"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              {!isCommAuthor && (
                                <button
                                  onClick={() => handleOpenReport('comment', comm.id, activePost.id)}
                                  className="text-zinc-500 hover:text-amber-400 p-0.5 cursor-pointer"
                                  title="Kommentar melden"
                                >
                                  <Flag className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {editingCommentId === comm.id ? (
                            <div className="space-y-2 pt-1">
                              <input
                                type="text"
                                value={editCommentContent}
                                onChange={(e) => setEditCommentContent(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs liquid-glass-input rounded"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingCommentId(null)}
                                  className="text-3xs text-zinc-400 hover:text-white px-2 py-0.5"
                                >
                                  Abbrechen
                                </button>
                                <button
                                  onClick={() => handleUpdateComment(comm.id)}
                                  className="text-3xs bg-white text-black font-semibold px-2 py-0.5 rounded"
                                >
                                  Speichern
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-300">{comm.content}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add comment input */}
              {isAuthenticated ? (
                <form onSubmit={handleAddComment} className="pt-3 border-t border-white/10 flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Antworten..."
                    className="flex-1 px-3 py-1.5 text-xs liquid-glass-input rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={!commentInput.trim()}
                    className="px-3 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="pt-3 border-t border-white/10 text-center">
                  <button
                    onClick={() => openAuthModal('login')}
                    className="w-full py-2 bg-white/10 hover:bg-white/15 text-white text-xs rounded-lg font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Anmelden, um mitzudiskutieren</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 liquid-glass rounded-xl border border-white/10 text-center text-zinc-500 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-zinc-600 stroke-[1.5]" />
              <p className="text-xs font-semibold text-zinc-300">Wähle einen Beitrag aus</p>
              <p className="text-2xs text-zinc-500">
                Klicke links auf eine Diskussion, um alle Antworten zu sehen und mitzudiskutieren.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg glass-2 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Neuen Beitrag verfassen</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-zinc-400 mb-1">Titel des Beitrags *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Tipps für saubere Container-Isolation in Docker Compose"
                  className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 mb-1">Kategorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl bg-black"
                  >
                    <option value="DevOps">DevOps &amp; HomeServer</option>
                    <option value="Programming">Programming &amp; C#</option>
                    <option value="ITA">ITA Ausbildung &amp; 8051</option>
                    <option value="Minecraft">Minecraft &amp; Fabric</option>
                    <option value="3D Printing">3D-Druck &amp; Bambu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 mb-1">Tags (kommagetrennt)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="Docker, HomeServer, Security"
                    className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-zinc-400 mb-1">Inhalt *</label>
                <textarea
                  rows={6}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Beschreibe deine Erkenntnisse, Code-Lösungen oder Fragen..."
                  className="w-full p-3.5 text-xs liquid-glass-input rounded-xl leading-relaxed font-sans resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim() || !newContent.trim()}
                  className="px-5 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer shadow-md"
                >
                  {isSubmitting ? 'Veröffentliche...' : 'Beitrag veröffentlichen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg glass-2 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Beitrag bearbeiten</h3>
              <button onClick={() => setEditingPost(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePost} className="space-y-4">
              <div>
                <label className="block text-2xs font-semibold text-zinc-400 mb-1">Titel *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 mb-1">Kategorie</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl bg-black"
                  >
                    <option value="DevOps">DevOps &amp; HomeServer</option>
                    <option value="Programming">Programming &amp; C#</option>
                    <option value="ITA">ITA Ausbildung &amp; 8051</option>
                    <option value="Minecraft">Minecraft &amp; Fabric</option>
                    <option value="3D Printing">3D-Druck &amp; Bambu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-zinc-400 mb-1">Tags (kommagetrennt)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs liquid-glass-input rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-zinc-400 mb-1">Inhalt *</label>
                <textarea
                  rows={6}
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3.5 text-xs liquid-glass-input rounded-xl leading-relaxed font-sans resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPost || !editTitle.trim() || !editContent.trim()}
                  className="px-5 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer shadow-md"
                >
                  {isUpdatingPost ? 'Speichere...' : 'Änderungen speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md glass-2 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Inhalt melden</h3>
              </div>
              <button onClick={() => setReportingItem(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <p className="text-xs text-zinc-300">
                Warum möchtest du diesen {reportingItem.type === 'post' ? 'Beitrag' : 'Kommentar'} melden?
              </p>

              <div>
                <label className="block text-2xs font-semibold text-zinc-400 mb-1">Grund der Meldung *</label>
                <textarea
                  rows={3}
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="z.B. Spam, beleidigende Inhalte, gefährliche Befehle oder Urheberrechtsverletzung..."
                  className="w-full p-3 text-xs liquid-glass-input rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setReportingItem(null)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport || !reportReason.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl disabled:opacity-50 transition-colors cursor-pointer shadow-md"
                >
                  {isSubmittingReport ? 'Sende...' : 'Meldung absenden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
