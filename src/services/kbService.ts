import { supabase } from '@/lib/supabase/client'
import { Article, Category } from '@/types'
import { isValidUUID } from '@/lib/utils'

export const kbService = {
  async getArticles(
    organizationId: string,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    categoryId?: string,
  ): Promise<{ data: Article[]; total: number }> {
    if (!isValidUUID(organizationId)) {
      return { data: [], total: 0 }
    }

    let query = supabase
      .from('kb_articles')
      .select(
        'id, title, content, category_id, author_id, created_at, updated_at, tags, organization_id',
        { count: 'exact' },
      )
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&')
      query = query.ilike('title', `%${sanitized}%`)
    }

    if (categoryId && categoryId !== 'all') {
      // Logic to include subcategories would ideally be here or handled by fetching category tree first
      // For simplicity in this service, we just filter by the specific category ID provided
      query = query.eq('category_id', categoryId)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    const articles: Article[] = data.map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content || '',
      categoryId: item.category_id,
      authorId: item.author_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      tags: item.tags || [],
    }))

    return { data: articles, total: count || 0 }
  },

  async getCategories(organizationId: string): Promise<Category[]> {
    if (!isValidUUID(organizationId)) return []

    const { data, error } = await supabase
      .from('kb_categories')
      .select('id, name, parent_id')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (error) throw error

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      parentId: item.parent_id,
    }))
  },

  async createArticle(
    article: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>,
    organizationId: string,
  ): Promise<Article> {
    const { data, error } = await supabase
      .from('kb_articles')
      .insert({
        organization_id: organizationId,
        title: article.title,
        content: article.content,
        category_id: article.categoryId,
        author_id: article.authorId,
        tags: article.tags,
        slug: article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'published',
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      title: data.title,
      content: data.content || '',
      categoryId: data.category_id,
      authorId: data.author_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tags: data.tags || [],
    }
  },

  async updateArticle(
    id: string,
    updates: Partial<Article>,
    editorId: string,
  ): Promise<void> {
    // We should also insert into kb_article_versions here, but for now we focus on the update
    const { error } = await supabase
      .from('kb_articles')
      .update({
        title: updates.title,
        content: updates.content,
        category_id: updates.categoryId,
        tags: updates.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    // Create version record
    if (updates.content) {
      const { error: versionError } = await supabase.from('kb_article_versions').insert({
        article_id: id,
        editor_id: editorId,
        title: updates.title || '',
        content: updates.content,
        tags: updates.tags,
      })
      if (versionError) {
        console.error('Failed to create article version:', versionError)
      }
    }
  },

  async deleteArticle(id: string): Promise<void> {
    const { error } = await supabase.from('kb_articles').delete().eq('id', id)

    if (error) throw error
  },

  async createCategory(
    name: string,
    parentId: string | null,
    organizationId: string,
  ): Promise<Category> {
    const { data, error } = await supabase
      .from('kb_categories')
      .insert({
        name,
        parent_id: parentId,
        organization_id: organizationId,
      })
      .select()
      .single()

    if (error) throw error

    return { id: data.id, name: data.name, parentId: data.parent_id }
  },

  async updateCategory(
    id: string,
    name: string,
    parentId: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from('kb_categories')
      .update({ name, parent_id: parentId })
      .eq('id', id)

    if (error) throw error
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('kb_categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
