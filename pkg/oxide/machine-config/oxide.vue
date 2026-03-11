<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import { NORMAN } from '@shell/config/types';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';

const DISK_TYPE_DEFAULT = 'distributed';

export default {
  emits: ['validationChanged'],

  components: {
    LabeledInput, LabeledSelect, Checkbox, Banner,
  },

  mixins: [CreateEditView, FormValidation],

  props: {
    credentialId: {
      type:     String,
      required: true,
    },

    disabled: {
      type:    Boolean,
      default: false,
    },
  },

  data() {
    return {
      fvFormRuleSets: [
        { path: 'project', rules: ['required'] },
        { path: 'bootDiskImageId', rules: ['required'] },
      ],
      projects:          [],
      projectsLoading:   false,
      projectsError:     null,
      vpcs:              [],
      vpcsLoading:       false,
      vpcsError:         null,
      subnets:           [],
      subnetsLoading:    false,
      subnetsError:      null,
      images:            [],
      imagesLoading:     false,
      imagesError:       null,
      sshKeys:           [],
      sshKeysLoading:    false,
      sshKeysError:      null,
      affinityGroups:    [],
      affinityLoading:   false,
      affinityError:     null,
      // Local working copy of additional disks. Serialized into
      // `value.additionalDisk` (a string slice) whenever it changes.
      additionalDisks:   [],
      diskTypeOptions:   [
        { label: 'Distributed', value: 'distributed' },
        { label: 'Local', value: 'local' },
      ],
    };
  },

  computed: {
    projectOptions() {
      return this.projects.map((p) => ({
        label: p.name,
        value: p.name,
      }));
    },

    vpcOptions() {
      return this.vpcs.map((v) => ({
        label: v.name,
        value: v.name,
      }));
    },

    subnetOptions() {
      return this.subnets.map((s) => ({
        label: s.name,
        value: s.name,
      }));
    },

    imageOptions() {
      return this.images.map((i) => ({
        label: i.name,
        value: i.id,
      }));
    },

    sshKeyOptions() {
      return this.sshKeys.map((k) => ({
        label: k.name,
        value: k.name,
      }));
    },

    affinityGroupOptions() {
      return this.affinityGroups.map((g) => ({
        label: g.name,
        value: g.name,
      }));
    },
  },

  watch: {
    fvFormIsValid(newValue) {
      this.$emit('validationChanged', !!newValue);
    },

    'value.project'(neu) {
      if (neu) {
        this.loadVpcs(neu);
        this.loadImages(neu);
        this.loadAffinityGroups(neu);
      } else {
        this.vpcs = [];
        this.images = [];
        this.affinityGroups = [];
      }
      this.subnets = [];
      this.value.subnet = '';
      this.value.bootDiskImageId = '';
      this.value.antiAffinityGroup = [];
    },

    'value.vpc'(neu) {
      if (neu && this.value.project) {
        this.loadSubnets(this.value.project, neu);
      } else {
        this.subnets = [];
      }
    },

    additionalDisks: {
      deep: true,
      handler() {
        this.syncAdditionalDisks();
      },
    },
  },

  async created() {
    // Note: vpc/subnet intentionally have no UI default. Pre-filling them
    // breaks the project → vpc → subnet cascade (subnet would unlock before a
    // vpc is chosen). The driver already defaults both to "default" when the
    // flag is left empty.
    const defaults = {
      vcpus:        '2',
      memory:       '4 GiB',
      bootDiskSize: '20 GiB',
      sshUser:      'oxide',
    };

    for (const [key, val] of Object.entries(defaults)) {
      if (!this.value[key] && this.value[key] !== 0) {
        this.value[key] = val;
      }
    }

    // Array-valued fields must exist before binding to ArrayListSelect.
    if (!Array.isArray(this.value.additionalDisk)) {
      this.value.additionalDisk = [];
    }
    if (!Array.isArray(this.value.sshPublicKey)) {
      this.value.sshPublicKey = [];
    }
    if (!Array.isArray(this.value.antiAffinityGroup)) {
      this.value.antiAffinityGroup = [];
    }

    this.additionalDisks = this.value.additionalDisk.map(
      (s) => this.parseAdditionalDisk(s)
    );

    await Promise.all([
      this.loadProjects(),
      this.loadSshKeys(),
    ]);
  },

  methods: {
    // Builds the option object for a value typed into a taggable select.
    // Returning { label, value } (rather than vue-select's default
    // { label }) ensures LabeledSelect's `reduce` stores the plain string,
    // which is what the driver expects.
    createOption(text) {
      const trimmed = (text || '').trim();

      return { label: trimmed, value: trimmed };
    },

    proxyHost(host) {
      return (host || '')
        .trim()
        .replace(/\/+$/, '')
        .replace(/^https?:\/\//, '');
    },

    async getHost() {
      const credential = await this.$store.dispatch('rancher/find', {
        type: NORMAN.CLOUD_CREDENTIAL,
        id:   this.credentialId,
      });

      const host = this.proxyHost(
        credential.decodedData?.host
      );

      if (!host) {
        throw new Error(
          'No host found on credential. '
          + 'Please re-create the cloud credential.'
        );
      }

      return host;
    },

    async oxideRequest(path) {
      const host = await this.getHost();

      return await this.$store.dispatch('management/request', {
        url:     `/meta/proxy/${ host }${ path }`,
        headers: {
          Accept:                    'application/json',
          'X-Api-CattleAuth-Header': `Bearer credID=${ this.credentialId } passwordField=token`,
        },
        redirectUnauthorized: false,
      });
    },

    async loadProjects() {
      this.projectsLoading = true;
      this.projectsError = null;

      try {
        const response = await this.oxideRequest('/v1/projects');

        this.projects = response.items || [];
      } catch (e) {
        this.projectsError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.projectsLoading = false;
      }
    },

    async loadVpcs(project) {
      this.vpcsLoading = true;
      this.vpcsError = null;
      this.vpcs = [];
      this.value.vpc = '';

      try {
        const response = await this.oxideRequest(
          `/v1/vpcs?project=${ encodeURIComponent(project) }`
        );

        this.vpcs = response.items || [];
      } catch (e) {
        this.vpcsError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.vpcsLoading = false;
      }
    },

    async loadImages(project) {
      this.imagesLoading = true;
      this.imagesError = null;
      this.images = [];
      this.value.bootDiskImageId = '';

      try {
        const [projectImages, siloImages] = await Promise.all([
          this.oxideRequest(
            `/v1/images?project=${ encodeURIComponent(project) }`
          ),
          this.oxideRequest('/v1/images'),
        ]);

        this.images = [
          ...(projectImages.items || []),
          ...(siloImages.items || []),
        ];
      } catch (e) {
        this.imagesError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.imagesLoading = false;
      }
    },

    async loadSubnets(project, vpc) {
      this.subnetsLoading = true;
      this.subnetsError = null;
      this.subnets = [];
      this.value.subnet = '';

      try {
        const response = await this.oxideRequest(
          `/v1/vpc-subnets`
          + `?project=${ encodeURIComponent(project) }`
          + `&vpc=${ encodeURIComponent(vpc) }`
        );

        this.subnets = response.items || [];
      } catch (e) {
        this.subnetsError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.subnetsLoading = false;
      }
    },

    async loadSshKeys() {
      this.sshKeysLoading = true;
      this.sshKeysError = null;

      try {
        const response = await this.oxideRequest('/v1/me/ssh-keys');

        this.sshKeys = response.items || [];
      } catch (e) {
        this.sshKeysError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.sshKeysLoading = false;
      }
    },

    async loadAffinityGroups(project) {
      this.affinityLoading = true;
      this.affinityError = null;
      this.affinityGroups = [];

      try {
        const response = await this.oxideRequest(
          `/v1/anti-affinity-groups?project=${ encodeURIComponent(project) }`
        );

        this.affinityGroups = response.items || [];
      } catch (e) {
        this.affinityError =
          e?.message || e?.data || JSON.stringify(e);
      } finally {
        this.affinityLoading = false;
      }
    },

    // parseAdditionalDisk converts a driver string into a working object.
    // Accepts the current `size=SIZE[,label=LABEL][,type=TYPE]` format and
    // the legacy `SIZE[[,LABEL],TYPE]` format.
    parseAdditionalDisk(str) {
      const disk = { size: '', label: '', type: DISK_TYPE_DEFAULT };

      if (!str) {
        return disk;
      }

      if (str.includes('=')) {
        for (const part of str.split(',')) {
          const trimmed = part.trim();

          if (!trimmed) {
            continue;
          }

          const idx = trimmed.indexOf('=');

          if (idx === -1) {
            continue;
          }

          const name = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();

          if (name === 'size') {
            disk.size = val;
          } else if (name === 'label') {
            disk.label = val;
          } else if (name === 'type') {
            disk.type = val;
          }
        }
      } else {
        const fields = str.split(',').map((f) => f.trim());

        disk.size = fields[0] || '';
        if (fields[1]) {
          disk.label = fields[1];
        }
        if (fields[2]) {
          disk.type = fields[2];
        }
      }

      return disk;
    },

    serializeAdditionalDisk(disk) {
      const parts = [`size=${ `${ disk.size }`.trim() }`];

      if (disk.label) {
        parts.push(`label=${ disk.label.trim() }`);
      }

      parts.push(`type=${ disk.type || DISK_TYPE_DEFAULT }`);

      return parts.join(',');
    },

    syncAdditionalDisks() {
      this.value.additionalDisk = this.additionalDisks
        .filter((d) => `${ d.size }`.trim())
        .map((d) => this.serializeAdditionalDisk(d));
    },

    addDisk() {
      this.additionalDisks.push({
        size: '', label: '', type: DISK_TYPE_DEFAULT,
      });
    },

    removeDisk(index) {
      this.additionalDisks.splice(index, 1);
      this.syncAdditionalDisks();
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-if="projectsError"
      color="error"
      :label="'Failed to load projects: ' + (projectsError.message || projectsError)"
    />

    <Banner
      v-if="vpcsError"
      color="error"
      :label="'Failed to load VPCs: ' + (vpcsError.message || vpcsError)"
    />

    <Banner
      v-if="subnetsError"
      color="error"
      :label="'Failed to load subnets: ' + (subnetsError.message || subnetsError)"
    />

    <Banner
      v-if="imagesError"
      color="error"
      :label="'Failed to load images: ' + (imagesError.message || imagesError)"
    />

    <Banner
      v-if="sshKeysError"
      color="error"
      :label="'Failed to load SSH keys: ' + (sshKeysError.message || sshKeysError)"
    />

    <Banner
      v-if="affinityError"
      color="error"
      :label="'Failed to load anti-affinity groups: ' + (affinityError.message || affinityError)"
    />

    <!-- General -->
    <div class="row">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.general') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.project"
          :mode="mode"
          :required="true"
          :disabled="disabled || projectsLoading"
          :loading="projectsLoading"
          :options="projectOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :rules="fvGetAndReportPathRules('project')"
          :label="t('cluster.machineConfig.oxide.project.label')"
          :placeholder="t('cluster.machineConfig.oxide.project.placeholder')"
        />
      </div>
    </div>

    <!-- Hardware -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.hardware') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.vcpus"
          :mode="mode"
          :disabled="disabled"
          type="number"
          min="1"
          :label="t('cluster.machineConfig.oxide.vcpus.label')"
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.memory"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.memory.label')"
          :placeholder="t('cluster.machineConfig.oxide.memory.placeholder')"
        />
      </div>
    </div>

    <!-- Boot Disk -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.bootDisk') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.bootDiskImageId"
          :mode="mode"
          :required="true"
          :disabled="disabled || imagesLoading || !value.project"
          :loading="imagesLoading"
          :options="imageOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :rules="fvGetAndReportPathRules('bootDiskImageId')"
          :label="t('cluster.machineConfig.oxide.bootDiskImageId.label')"
          :placeholder="t('cluster.machineConfig.oxide.bootDiskImageId.placeholder')"
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.bootDiskSize"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.bootDiskSize.label')"
          :placeholder="t('cluster.machineConfig.oxide.bootDiskSize.placeholder')"
        />
      </div>
    </div>

    <!-- Additional Disks -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.additionalDisks') }}</h3>
      </div>
    </div>
    <div
      v-for="(disk, i) in additionalDisks"
      :key="i"
      class="row mb-10"
    >
      <div class="col span-4">
        <LabeledInput
          v-model:value="disk.size"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.additionalDisk.size.label')"
          :placeholder="t('cluster.machineConfig.oxide.additionalDisk.size.placeholder')"
        />
      </div>
      <div class="col span-3">
        <LabeledInput
          v-model:value="disk.label"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.additionalDisk.diskLabel.label')"
          :placeholder="t('cluster.machineConfig.oxide.additionalDisk.diskLabel.placeholder')"
        />
      </div>
      <div class="col span-3">
        <LabeledSelect
          v-model:value="disk.type"
          :mode="mode"
          :disabled="disabled"
          :options="diskTypeOptions"
          :label="t('cluster.machineConfig.oxide.additionalDisk.type.label')"
        />
      </div>
      <div class="col span-2 additional-disk-remove">
        <button
          type="button"
          class="btn role-link"
          :disabled="disabled"
          @click="removeDisk(i)"
        >
          {{ t('generic.remove') }}
        </button>
      </div>
    </div>
    <div class="row">
      <div class="col span-12">
        <button
          type="button"
          class="btn role-tertiary"
          :disabled="disabled"
          @click="addDisk()"
        >
          {{ t('cluster.machineConfig.oxide.additionalDisk.add') }}
        </button>
      </div>
    </div>

    <!-- Networking -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.networking') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.vpc"
          :mode="mode"
          :disabled="disabled || vpcsLoading || !value.project"
          :loading="vpcsLoading"
          :options="vpcOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :label="t('cluster.machineConfig.oxide.vpc.label')"
        />
      </div>
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.subnet"
          :mode="mode"
          :disabled="disabled || subnetsLoading || !value.vpc"
          :loading="subnetsLoading"
          :options="subnetOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :label="t('cluster.machineConfig.oxide.subnet.label')"
        />
      </div>
    </div>
    <div class="row mt-10">
      <div class="col span-6">
        <Checkbox
          v-model:value="value.ephemeralIpAttach"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.ephemeralIpAttach.label')"
        />
      </div>
    </div>
    <div
      v-if="value.ephemeralIpAttach"
      class="row mt-10"
    >
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.ephemeralIpPool"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.ephemeralIpPool.label')"
          :placeholder="t('cluster.machineConfig.oxide.ephemeralIpPool.placeholder')"
        />
      </div>
    </div>

    <!-- Authentication -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.authentication') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.sshUser"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.sshUser.label')"
        />
      </div>
    </div>
    <div class="row mt-10">
      <div class="col span-12">
        <LabeledSelect
          v-model:value="value.sshPublicKey"
          :multiple="true"
          :mode="mode"
          :disabled="disabled"
          :loading="sshKeysLoading"
          :options="sshKeyOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :label="t('cluster.machineConfig.oxide.sshPublicKey.label')"
        />
      </div>
    </div>

    <!-- Affinity -->
    <div class="row mt-20">
      <div class="col span-12">
        <h3>{{ t('cluster.machineConfig.oxide.sections.affinity') }}</h3>
      </div>
    </div>
    <div class="row">
      <div class="col span-12">
        <LabeledSelect
          v-model:value="value.antiAffinityGroup"
          :multiple="true"
          :mode="mode"
          :disabled="disabled || !value.project"
          :loading="affinityLoading"
          :options="affinityGroupOptions"
          :taggable="true"
          :push-tags="true"
          :create-option="createOption"
          :label="t('cluster.machineConfig.oxide.antiAffinityGroup.label')"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.additional-disk-remove {
  display: flex;
  align-items: center;
}
</style>
