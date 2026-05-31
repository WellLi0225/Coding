<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type ChampionRole =
  | 'Fighter'
  | 'Tank'
  | 'Mage'
  | 'Assassin'
  | 'Marksman'
  | 'Support'

type ChampionImage = {
  full: string
}

type Champion = {
  id: string
  key: string
  name: string
  title: string
  blurb: string
  image: ChampionImage
  tags: ChampionRole[]
}

type ChampionResponse = {
  data: Record<string, Champion>
}

const roleLabels: Record<ChampionRole, string> = {
  Fighter: '전사',
  Tank: '탱커',
  Mage: '마법사',
  Assassin: '암살자',
  Marksman: '원거리 딜러',
  Support: '서포터',
}

const roleOptions: Array<{ value: ChampionRole; label: string }> = [
  { value: 'Fighter', label: '전사' },
  { value: 'Tank', label: '탱커' },
  { value: 'Mage', label: '마법사' },
  { value: 'Assassin', label: '암살자' },
  { value: 'Marksman', label: '원거리 딜러' },
  { value: 'Support', label: '서포터' },
]

const champions = ref<Champion[]>([])
const latestVersion = ref('')
const searchTerm = ref('')
const selectedRoles = ref<ChampionRole[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

const roleButtonText = computed(() => {
  if (selectedRoles.value.length === 0) {
    return '전체'
  }

  return selectedRoles.value.map((role) => roleLabels[role]).join(', ')
})

const filteredChampions = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase()

  return champions.value.filter((champion) => {
    const matchesRole =
      selectedRoles.value.length === 0 ||
      selectedRoles.value.every((role) => champion.tags.includes(role))

    const searchableText = [
      champion.id,
      champion.name,
      champion.title,
      ...champion.tags,
      ...champion.tags.map((tag) => roleLabels[tag]),
    ]
      .join(' ')
      .toLowerCase()

    const matchesKeyword = !keyword || searchableText.includes(keyword)

    return matchesRole && matchesKeyword
  })
})

const clearRoles = () => {
  selectedRoles.value = []
}

const championImageUrl = (champion: Champion) =>
  `https://ddragon.leagueoflegends.com/cdn/${latestVersion.value}/img/champion/${champion.image.full}`

const loadChampions = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const versionsResponse = await fetch(
      'https://ddragon.leagueoflegends.com/api/versions.json',
    )

    if (!versionsResponse.ok) {
      throw new Error('버전 정보를 불러오지 못했습니다.')
    }

    const versions = (await versionsResponse.json()) as string[]
    const version = versions[0]
    latestVersion.value = version

    const championsResponse = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`,
    )

    if (!championsResponse.ok) {
      throw new Error('챔피언 정보를 불러오지 못했습니다.')
    }

    const championData = (await championsResponse.json()) as ChampionResponse
    champions.value = Object.values(championData.data).sort((a, b) =>
      a.name.localeCompare(b.name, 'ko-KR'),
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '챔피언 목록을 불러오는 중 문제가 발생했습니다.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadChampions)
</script>

<template>
  <main class="shell">
    <section class="header-panel">
      <div>
        <p class="eyebrow">League of Legends</p>
        <h1>챔피언 목록</h1>
        <p class="summary">
          Riot Data Dragon API에서 최신 한국어 챔피언 데이터를 가져옵니다.
        </p>
      </div>

      <div class="stats" aria-label="챔피언 데이터 상태">
        <span>버전 {{ latestVersion || '-' }}</span>
        <strong>{{ champions.length }}</strong>
        <span>챔피언</span>
      </div>
    </section>

    <section class="toolbar" aria-label="챔피언 검색 및 역할군 필터">
      <label for="champion-search">검색</label>
      <input
        id="champion-search"
        v-model="searchTerm"
        type="search"
        placeholder="이름, 영문명, 역할로 검색"
      />

      <span class="role-label">역할군</span>
      <details class="role-combo">
        <summary class="role-trigger">
          <span>{{ roleButtonText }}</span>
        </summary>

        <div class="role-menu">
          <button class="clear-roles" type="button" @click="clearRoles">
            전체
          </button>

          <label
            v-for="role in roleOptions"
            :key="role.value"
            class="role-option"
          >
            <input
              v-model="selectedRoles"
              type="checkbox"
              :value="role.value"
            />
            <span>{{ role.label }}</span>
          </label>
        </div>
      </details>
    </section>

    <section v-if="isLoading" class="state-panel">
      챔피언 데이터를 불러오는 중입니다.
    </section>

    <section v-else-if="errorMessage" class="state-panel error">
      <p>{{ errorMessage }}</p>
      <button type="button" @click="loadChampions">다시 시도</button>
    </section>

    <section v-else class="champion-grid" aria-label="챔피언 목록">
      <article
        v-for="champion in filteredChampions"
        :key="champion.key"
        class="champion-card"
      >
        <img :src="championImageUrl(champion)" :alt="`${champion.name} 초상화`" />
        <div class="champion-copy">
          <div>
            <h2>{{ champion.name }}</h2>
            <p>{{ champion.title }}</p>
          </div>
          <div class="tags">
            <span v-for="tag in champion.tags" :key="tag">
              {{ roleLabels[tag] }}
            </span>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
