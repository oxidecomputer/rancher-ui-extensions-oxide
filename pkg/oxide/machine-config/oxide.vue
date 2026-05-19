<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import { NORMAN } from '@shell/config/types';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';

export default {
  emits: ['validationChanged'],

  components: { LabeledInput, LabeledSelect, Checkbox, Banner },

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
      projects:        [],
      projectsLoading: false,
      projectsError:   null,
      vpcs:            [],
      vpcsLoading:     false,
      vpcsError:       null,
      subnets:         [],
      subnetsLoading:  false,
      subnetsError:    null,
      images:          [],
      imagesLoading:   false,
      imagesError:     null,
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
  },

  watch: {
    fvFormIsValid(newValue) {
      this.$emit('validationChanged', !!newValue);
    },

    'value.project'(neu) {
      if (neu) {
        this.loadVpcs(neu);
        this.loadImages(neu);
      } else {
        this.vpcs = [];
        this.images = [];
      }
      this.subnets = [];
      this.value.subnet = '';
      this.value.bootDiskImageId = '';
    },

    'value.vpc'(neu) {
      if (neu && this.value.project) {
        this.loadSubnets(this.value.project, neu);
      } else {
        this.subnets = [];
      }
    },
  },

  async created() {
    const defaults = {
      vcpus:        '2',
      memory:       '4 GiB',
      bootDiskSize: '20 GiB',
      vpc:          'default',
      subnet:       'default',
      sshUser:      'oxide',
    };

    for (const [key, val] of Object.entries(defaults)) {
      if (!this.value[key] && this.value[key] !== 0) {
        this.value[key] = val;
      }
    }

    await this.loadProjects();
  },

  methods: {
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

    <!-- Project & Boot Disk Image -->
    <div class="row mt-20">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.project"
          :mode="mode"
          :required="true"
          :disabled="disabled || projectsLoading"
          :loading="projectsLoading"
          :options="projectOptions"
          :rules="fvGetAndReportPathRules('project')"
          :label="t('cluster.machineConfig.oxide.project.label')"
          :placeholder="t('cluster.machineConfig.oxide.project.placeholder')"
        />
      </div>
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.bootDiskImageId"
          :mode="mode"
          :required="true"
          :disabled="disabled || imagesLoading || !value.project"
          :loading="imagesLoading"
          :options="imageOptions"
          :rules="fvGetAndReportPathRules('bootDiskImageId')"
          :label="t('cluster.machineConfig.oxide.bootDiskImageId.label')"
          :placeholder="t('cluster.machineConfig.oxide.bootDiskImageId.placeholder')"
        />
      </div>
    </div>

    <!-- Hardware -->
    <div class="row mt-20">
      <div class="col span-4">
        <LabeledInput
          v-model:value="value.vcpus"
          :mode="mode"
          :disabled="disabled"
          type="number"
          min="1"
          :label="t('cluster.machineConfig.oxide.vcpus.label')"
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value="value.memory"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.memory.label')"
          :placeholder="t('cluster.machineConfig.oxide.memory.placeholder')"
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value="value.bootDiskSize"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.bootDiskSize.label')"
          :placeholder="t('cluster.machineConfig.oxide.bootDiskSize.placeholder')"
        />
      </div>
    </div>

    <!-- Networking -->
    <div class="row mt-20">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.vpc"
          :mode="mode"
          :disabled="disabled || vpcsLoading || !value.project"
          :loading="vpcsLoading"
          :options="vpcOptions"
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
          :label="t('cluster.machineConfig.oxide.subnet.label')"
        />
      </div>
    </div>

    <!-- Ephemeral IP -->
    <div class="row mt-20">
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

    <!-- SSH -->
    <div class="row mt-20">
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.sshUser"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.sshUser.label')"
        />
      </div>
    </div>
  </div>
</template>
