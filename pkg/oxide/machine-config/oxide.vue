<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';

export default {
  components: { LabeledInput, Checkbox },

  mixins: [CreateEditView],

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

  created() {
    const defaults = {
      vcpus:        2,
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
  },
};
</script>

<template>
  <div>
    <!-- Project & Boot Disk Image -->
    <div class="row mt-20">
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.project"
          :mode="mode"
          :required="true"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.project.label')"
          :placeholder="t('cluster.machineConfig.oxide.project.placeholder')"
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.bootDiskImageId"
          :mode="mode"
          :required="true"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.bootDiskImageId.label')"
          :placeholder="t('cluster.machineConfig.oxide.bootDiskImageId.placeholder')"
        />
      </div>
    </div>

    <!-- Hardware -->
    <div class="row mt-20">
      <div class="col span-4">
        <LabeledInput
          v-model:value.number="value.vcpus"
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
        <LabeledInput
          v-model:value="value.vpc"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.vpc.label')"
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.subnet"
          :mode="mode"
          :disabled="disabled"
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

    <!-- User Data -->
    <div class="row mt-20">
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.userDataFile"
          :mode="mode"
          :disabled="disabled"
          :label="t('cluster.machineConfig.oxide.userDataFile.label')"
          :placeholder="t('cluster.machineConfig.oxide.userDataFile.placeholder')"
        />
      </div>
    </div>
  </div>
</template>
